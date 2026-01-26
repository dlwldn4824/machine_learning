import express from 'express';
import { getDatabase } from '../database/db.js';

const router = express.Router();
const db = getDatabase();

// 팀원들의 일정 가용성 조회 (개인정보 보호 - 구체적인 일정 내용은 숨김)
router.post('/availability', (req, res) => {
  try {
    const { startDate, endDate, roomId } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: '시작일과 종료일을 입력해주세요.' });
    }

    // 채팅방의 모든 사용자 가져오기 (메시지에서)
    let users = [];
    if (roomId) {
      const messages = db.prepare(`
        SELECT DISTINCT user_name 
        FROM chat_messages 
        WHERE room_id = ?
      `).all(roomId);
      users = messages.map(m => m.user_name);
    }

    // 각 사용자의 일정 조회 (구체적인 내용은 숨기고 가용성만 반환)
    const availability = users.map(userName => {
      const schedules = db.prepare(`
        SELECT 
          start_date,
          end_date,
          is_adjustable
        FROM schedules
        WHERE start_date >= ? AND start_date <= ?
        ORDER BY start_date ASC
      `).all(startDate, endDate);

      // 시간대별 가용성 계산 (개인정보 보호)
      const timeSlots = generateTimeSlots(startDate, endDate);
      const availabilityMap = {};

      timeSlots.forEach(slot => {
        const conflicts = schedules.filter(schedule => {
          const scheduleStart = new Date(schedule.start_date);
          const scheduleEnd = schedule.end_date ? new Date(schedule.end_date) : scheduleStart;
          const slotStart = new Date(slot.start);
          const slotEnd = new Date(slot.end);

          return (slotStart >= scheduleStart && slotStart < scheduleEnd) ||
                 (slotEnd > scheduleStart && slotEnd <= scheduleEnd) ||
                 (slotStart <= scheduleStart && slotEnd >= scheduleEnd);
        });

        if (conflicts.length === 0) {
          availabilityMap[slot.key] = 'available'; // 일정 없음
        } else {
          // 조정 가능한 일정이 하나라도 있으면 조정 가능
          const hasAdjustable = conflicts.some(s => s.is_adjustable === 1);
          availabilityMap[slot.key] = hasAdjustable ? 'adjustable' : 'fixed'; // 조정 가능 / 불가능
        }
      });

      return {
        userName,
        availability: availabilityMap
      };
    });

    res.json({
      startDate,
      endDate,
      users: availability
    });
  } catch (error) {
    console.error('가용성 조회 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 최적 일정 제안
router.post('/suggest', (req, res) => {
  try {
    const { startDate, endDate, roomId, duration = 60 } = req.body; // duration: 분 단위

    if (!startDate || !endDate) {
      return res.status(400).json({ error: '시작일과 종료일을 입력해주세요.' });
    }

    // 가용성 조회
    const availabilityResponse = {
      startDate,
      endDate,
      roomId
    };

    // 가용성 데이터 가져오기
    let users = [];
    if (roomId) {
      const messages = db.prepare(`
        SELECT DISTINCT user_name 
        FROM chat_messages 
        WHERE room_id = ?
      `).all(roomId);
      users = messages.map(m => m.user_name);
    }

    const timeSlots = generateTimeSlots(startDate, endDate, duration);
    const suggestions = [];

    timeSlots.forEach(slot => {
      let riskScore = 0;
      let adjustableCount = 0;
      let fixedCount = 0;
      let availableCount = 0;
      const userStatuses = {};

      users.forEach(userName => {
        const schedules = db.prepare(`
          SELECT 
            start_date,
            end_date,
            is_adjustable
          FROM schedules
          WHERE start_date >= ? AND start_date <= ?
        `).all(startDate, endDate);

        const conflicts = schedules.filter(schedule => {
          const scheduleStart = new Date(schedule.start_date);
          const scheduleEnd = schedule.end_date ? new Date(schedule.end_date) : scheduleStart;
          const slotStart = new Date(slot.start);
          const slotEnd = new Date(slot.end);

          return (slotStart >= scheduleStart && slotStart < scheduleEnd) ||
                 (slotEnd > scheduleStart && slotEnd <= scheduleEnd) ||
                 (slotStart <= scheduleStart && slotEnd >= scheduleEnd);
        });

        if (conflicts.length === 0) {
          availableCount++;
          userStatuses[userName] = 'available';
        } else {
          const hasAdjustable = conflicts.some(s => s.is_adjustable === 1);
          if (hasAdjustable) {
            adjustableCount++;
            riskScore += 1; // 조정 가능한 일정은 리스크 낮음
            userStatuses[userName] = 'adjustable';
          } else {
            fixedCount++;
            riskScore += 3; // 조정 불가능한 일정은 리스크 높음
            userStatuses[userName] = 'fixed';
          }
        }
      });

      const totalUsers = users.length;
      const participationRate = (availableCount + adjustableCount) / totalUsers;

      suggestions.push({
        start: slot.start,
        end: slot.end,
        riskScore,
        participationRate,
        availableCount,
        adjustableCount,
        fixedCount,
        totalUsers,
        userStatuses
      });
    });

    // 리스크 점수가 낮고 참여율이 높은 순으로 정렬
    suggestions.sort((a, b) => {
      if (a.riskScore !== b.riskScore) {
        return a.riskScore - b.riskScore; // 리스크 낮은 순
      }
      return b.participationRate - a.participationRate; // 참여율 높은 순
    });

    res.json({
      suggestions: suggestions.slice(0, 10), // 상위 10개 제안
      timeSlots: timeSlots.map(slot => ({
        start: slot.start,
        end: slot.end,
        key: slot.key
      }))
    });
  } catch (error) {
    console.error('일정 제안 오류:', error);
    res.status(500).json({ error: error.message });
  }
});

// 시간대 슬롯 생성
function generateTimeSlots(startDate, endDate, durationMinutes = 60) {
  const slots = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  // 하루를 시간대별로 나눔 (예: 1시간 단위)
  const hoursPerDay = 24;
  const slotsPerDay = Math.floor((hoursPerDay * 60) / durationMinutes);

  let currentDate = new Date(start);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= end) {
    for (let i = 0; i < slotsPerDay; i++) {
      const slotStart = new Date(currentDate);
      slotStart.setHours(Math.floor(i * durationMinutes / 60));
      slotStart.setMinutes((i * durationMinutes) % 60);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

      // 종료일을 넘지 않는 경우만 추가
      if (slotEnd <= new Date(end)) {
        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
          key: `${currentDate.toISOString().split('T')[0]}_${i}`
        });
      }
    }

    // 다음 날로 이동
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(0, 0, 0, 0);
  }

  return slots;
}

export default router;
