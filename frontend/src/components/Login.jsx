import { useState } from 'react'
import './Login.css'

function Login({ onLogin }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'student'
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        localStorage.setItem('user', JSON.stringify(data.user))
        onLogin(data.user)
      } else {
        setError(data.error || '로그인에 실패했습니다.')
      }
    } catch (error) {
      setError('로그인 중 오류가 발생했습니다.')
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>📚 Todo Calendar App</h1>
        <h2>로그인</h2>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>역할 선택</label>
            <div className="role-selector">
              <button
                type="button"
                className={`role-btn ${formData.role === 'student' ? 'active' : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, role: 'student' }))}
              >
                👨‍🎓 학생
              </button>
              <button
                type="button"
                className={`role-btn ${formData.role === 'professor' ? 'active' : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, role: 'professor' }))}
              >
                👨‍🏫 교수님
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>사용자명</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="사용자명을 입력하세요"
              required
            />
          </div>

          <div className="form-group">
            <label>비밀번호</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="login-hint">
          <p><strong>테스트 계정:</strong></p>
          <p>교수님: username: professor, password: professor123</p>
          <p>학생: username: student1, password: student123</p>
        </div>
      </div>
    </div>
  )
}

export default Login
