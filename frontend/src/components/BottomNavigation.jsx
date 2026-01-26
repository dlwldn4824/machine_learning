import './BottomNavigation.css'

function BottomNavigation({ activeTab, onTabChange, userRole }) {
  return (
    <nav className="bottom-navigation">
      <button
        className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => onTabChange('home')}
      >
        <span className="nav-icon">🏠</span>
        <span className="nav-label">홈</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
        onClick={() => onTabChange('chat')}
      >
        <span className="nav-icon">💬</span>
        <span className="nav-label">채팅</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'schedule-matching' ? 'active' : ''}`}
        onClick={() => onTabChange('schedule-matching')}
      >
        <span className="nav-icon">📅</span>
        <span className="nav-label">일정맞추기</span>
      </button>
      {userRole === 'professor' && (
        <button
          className={`nav-item ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => onTabChange('analysis')}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">분석</span>
        </button>
      )}
      <button
        className={`nav-item ${activeTab === 'mypage' ? 'active' : ''}`}
        onClick={() => onTabChange('mypage')}
      >
        <span className="nav-icon">👤</span>
        <span className="nav-label">마이페이지</span>
      </button>
    </nav>
  )
}

export default BottomNavigation
