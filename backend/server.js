import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initDatabase } from './database/db.js';
import scheduleRoutes from './routes/schedules.js';
import todoRoutes from './routes/todos.js';
import categoryRoutes from './routes/categories.js';
import chatRoutes, { saveMessage } from './routes/chat.js';
import authRoutes from './routes/auth.js';
import analysisRoutes from './routes/analysis.js';
import scheduleMatchingRoutes from './routes/scheduleMatching.js';
import usersRoutes from './routes/users.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5001;

// 데이터베이스 초기화
initDatabase();

// 미들웨어
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// OPTIONS 요청 처리
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Socket.io 연결
io.on('connection', (socket) => {
  console.log('클라이언트 연결:', socket.id);

  // 채팅방 입장
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`사용자 ${socket.id}가 방 ${roomId}에 입장했습니다.`);
  });

  // 채팅방 퇴장
  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    console.log(`사용자 ${socket.id}가 방 ${roomId}에서 퇴장했습니다.`);
  });

  // 메시지 전송
  socket.on('send-message', async (data) => {
    try {
      // 메시지를 데이터베이스에 저장
      const savedMessage = saveMessage(data.roomId, data.userName, data.message);
      
      // 모든 클라이언트에 메시지 전송
      io.to(data.roomId).emit('receive-message', savedMessage);
    } catch (error) {
      console.error('메시지 저장 실패:', error);
      socket.emit('error', { message: '메시지 전송에 실패했습니다.' });
    }
  });

  socket.on('disconnect', () => {
    console.log('클라이언트 연결 해제:', socket.id);
  });
});

// 라우트
app.use('/api/schedules', scheduleRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/schedule-matching', scheduleMatchingRoutes);
app.use('/api/users', usersRoutes);

// 기본 라우트
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});

export { io };
