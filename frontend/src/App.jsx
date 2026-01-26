import { useState, useEffect } from 'react'
import Login from './components/Login'
import Calendar from './components/Calendar'
import TodoList from './components/TodoList'
import Chat from './components/Chat'
import HomeHeader from './components/HomeHeader'
import BottomNavigation from './components/BottomNavigation'
import MyPage from './components/MyPage'
import AnalysisDashboard from './components/AnalysisDashboard'
import ScheduleMatching from './components/ScheduleMatching'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('home')
  const [chatRooms, setChatRooms] = useState([])

  useEffect(() => {
    // 로컬 스토리지에서 사용자 정보 확인
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    fetchChatRooms()
  }, [])

  const fetchChatRooms = async () => {
    try {
      const response = await fetch('/api/chat/rooms', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        console.error('채팅방 조회 실패:', response.status, response.statusText)
        return
      }
      
      const data = await response.json()
      setChatRooms(data)
    } catch (error) {
      console.error('채팅방 조회 실패:', error)
    }
  }

  const handleChatRoomClick = (room) => {
    setActiveTab('chat')
    // 채팅 컴포넌트에서 해당 방으로 이동하도록 처리
  }

  const handleLogin = (userData) => {
    setUser(userData)
    if (userData.role === 'professor') {
      setActiveTab('analysis')
    } else {
      setActiveTab('home')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
  }

  // 로그인하지 않은 경우
  if (!user) {
    return <Login onLogin={handleLogin} />
  }

  // 교수님인 경우 분석 대시보드 표시
  if (user.role === 'professor' && activeTab === 'analysis') {
    return (
      <div className="App">
        <div className="professor-header">
          <h1>📊 분석 대시보드</h1>
          <button onClick={handleLogout} className="logout-btn">로그아웃</button>
        </div>
        <AnalysisDashboard user={user} />
      </div>
    )
  }

  return (
    <div className="App">
      {activeTab === 'home' && (
        <HomeHeader 
          onChatRoomClick={handleChatRoomClick}
          chatRooms={chatRooms}
        />
      )}

      <main className="App-main">
        {activeTab === 'home' && (
          <div className="home-view">
            <TodoList />
            <div className="calendar-section">
              <h2 className="section-title">캘린더</h2>
              <Calendar />
            </div>
          </div>
        )}
        {activeTab === 'chat' && (
          <Chat 
            user={user}
            onScheduleCreate={() => {
              // 일정 생성 후 새로고침 등 처리
            }}
            onTodoCreate={() => {
              // Todo 생성 후 새로고침 등 처리
            }}
          />
        )}
        {activeTab === 'mypage' && <MyPage />}
        {activeTab === 'schedule-matching' && (
          <ScheduleMatching chatRooms={chatRooms} />
        )}
        {user.role === 'professor' && activeTab === 'analysis' && (
          <AnalysisDashboard user={user} />
        )}
      </main>

      <BottomNavigation 
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userRole={user.role}
      />
    </div>
  )
}

export default App
