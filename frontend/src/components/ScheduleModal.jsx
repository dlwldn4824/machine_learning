import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import './ScheduleModal.css'

function ScheduleModal({ date, schedule, categories, onClose, onDelete, onRefresh }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    category_id: '',
    is_adjustable: false
  })

  useEffect(() => {
    if (schedule) {
      setFormData({
        title: schedule.title || '',
        description: schedule.description || '',
        start_date: schedule.start_date || '',
        end_date: schedule.end_date || '',
        category_id: schedule.category_id || '',
        is_adjustable: schedule.is_adjustable === 1
      })
    } else if (date) {
      const dateStr = format(date, 'yyyy-MM-dd')
      setFormData(prev => ({
        ...prev,
        start_date: dateStr,
        end_date: dateStr
      }))
    }
  }, [schedule, date])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      const url = schedule ? `/api/schedules/${schedule.id}` : '/api/schedules'
      const method = schedule ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        onRefresh()
        onClose()
      } else {
        const error = await response.json()
        alert(error.error || '일정 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('일정 저장 실패:', error)
      alert('일정 저장에 실패했습니다.')
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{schedule ? '일정 수정' : '새 일정 추가'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="schedule-form">
          <div className="form-group">
            <label>일정 제목 *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="일정 제목을 입력하세요"
            />
          </div>

          <div className="form-group">
            <label>설명</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="3"
              placeholder="일정에 대한 설명을 입력하세요"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>시작 날짜 *</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label>종료 날짜</label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>카테고리</label>
            <select
              name="category_id"
              value={formData.category_id}
              onChange={handleChange}
            >
              <option value="">카테고리 선택</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="is_adjustable"
                checked={formData.is_adjustable}
                onChange={handleChange}
              />
              조정 가능한 일정
            </label>
            <span className="help-text">
              체크하면 일정을 변경하거나 이동할 수 있습니다.
            </span>
          </div>

          <div className="modal-actions">
            {schedule && (
              <button
                type="button"
                className="btn-delete"
                onClick={() => onDelete(schedule.id)}
              >
                삭제
              </button>
            )}
            <div className="action-buttons">
              <button type="button" className="btn-cancel" onClick={onClose}>
                취소
              </button>
              <button type="submit" className="btn-submit">
                {schedule ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ScheduleModal
