import { useState, useEffect } from 'react'
import './MyPage.css'

function MyPage() {
  const [user, setUser] = useState(null)
  const [chatId, setChatId] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem('user') || '{}')
    setUser(savedUser)
    if (savedUser.chat_id) {
      setChatId(savedUser.chat_id)
    }
  }, [])

  const handleUpdateChatId = async (e) => {
    e.preventDefault()
    if (!chatId.trim()) {
      setMessage('채팅 ID를 입력해주세요.')
      return
    }

    if (!user || !user.id) {
      setMessage('로그인이 필요합니다.')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const response = await fetch(`/api/users/${user.id}/chat-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId.trim() })
      })

      const data = await response.json()

      if (response.ok) {
        // 로컬 스토리지 업데이트
        const updatedUser = { ...user, chat_id: data.chat_id }
        localStorage.setItem('user', JSON.stringify(updatedUser))
        setUser(updatedUser)
        setMessage('채팅 ID가 설정되었습니다!')
      } else {
        setMessage(data.error || '설정에 실패했습니다.')
      }
    } catch (error) {
      console.error('Chat ID 업데이트 오류:', error)
      setMessage('설정 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mypage-container">
      <div className="mypage-header">
        <div className="profile-section">
          <div className="profile-avatar-large">
            <span>👤</span>
          </div>
          <h2>{user?.name || '사용자'}</h2>
          <p>{user?.username || 'user@example.com'}</p>
        </div>
      </div>

      <div className="mypage-content">
        <section className="mypage-section">
          <h3>채팅 설정</h3>
          <form onSubmit={handleUpdateChatId} className="chat-id-form">
            <div className="form-group">
              <label>채팅 ID</label>
              <p className="form-help">
                다른 사용자가 이 ID로 당신을 채팅방에 초대할 수 있습니다.
              </p>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="예: my_chat_id"
                maxLength={20}
              />
            </div>
            {message && (
              <div className={`message ${message.includes('실패') || message.includes('오류') ? 'error' : 'success'}`}>
                {message}
              </div>
            )}
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? '저장 중...' : '저장'}
            </button>
          </form>
        </section>

        <section className="mypage-section">
          <h3>설정</h3>
          <div className="setting-item">
            <span>알림 설정</span>
            <button>설정</button>
          </div>
          <div className="setting-item">
            <span>테마 설정</span>
            <button>설정</button>
          </div>
        </section>

        <section className="mypage-section">
          <h3>통계</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">0</div>
              <div className="stat-label">완료한 일정</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">0</div>
              <div className="stat-label">진행 중인 Todo</div>
            </div>
          </div>
        </section>

        <section className="mypage-section">
          <h3>정보</h3>
          <div className="info-item">
            <span>역할</span>
            <span>{user?.role === 'professor' ? '교수님' : '학생'}</span>
          </div>
          <div className="info-item">
            <span>버전</span>
            <span>1.0.0</span>
          </div>
        </section>
      </div>
    </div>
  )
}

export default MyPage
