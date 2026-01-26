import { useState, useEffect } from 'react'
import './AnalysisDashboard.css'

function AnalysisDashboard({ user }) {
  const [chatUrl, setChatUrl] = useState('')
  const [roomName, setRoomName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inputMode, setInputMode] = useState('code') // 'code' or 'url'

  const handleAnalyzeByCode = async (e) => {
    e.preventDefault()
    if (!roomCode.trim()) {
      setError('채팅방 코드를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')
    setAnalysis(null)

    try {
      // 코드로 채팅방 조회
      const roomResponse = await fetch(`/api/chat/rooms/code/${roomCode.trim().toUpperCase()}`)
      
      if (!roomResponse.ok) {
        const errorData = await roomResponse.json()
        setError(errorData.error || '채팅방을 찾을 수 없습니다.')
        setLoading(false)
        return
      }

      const room = await roomResponse.json()

      // 채팅방 분석 실행
      const analysisResponse = await fetch(`/api/analysis/analyze/${room.id}`, {
        method: 'POST'
      })

      const data = await analysisResponse.json()

      if (data.analysis) {
        setAnalysis({
          ...data,
          roomCode: room.code // 채팅방 코드 추가
        })
      } else {
        setError('분석에 실패했습니다.')
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setError('분석 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyze = async (e) => {
    e.preventDefault()
    
    if (inputMode === 'code') {
      handleAnalyzeByCode(e)
      return
    }

    if (!chatUrl.trim()) {
      setError('채팅 URL을 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')
    setAnalysis(null)

    try {
      const response = await fetch('/api/analysis/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: chatUrl,
          roomName: roomName || '분석 채팅방'
        })
      })

      const data = await response.json()

      if (data.analysis) {
        setAnalysis(data)
      } else {
        setError('분석에 실패했습니다.')
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setError('분석 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAnalyzeRoom = async (roomId) => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/analysis/analyze/${roomId}`, {
        method: 'POST'
      })

      const data = await response.json()

      if (data.analysis) {
        setAnalysis(data)
      } else {
        setError('분석에 실패했습니다.')
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setError('분석 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="analysis-dashboard">
      <div className="dashboard-header">
        <h1>📊 채팅 분석 대시보드</h1>
        <p>교수님 전용 - 채팅방의 키워드와 조원들의 기여도를 분석합니다</p>
      </div>

      <div className="dashboard-content">
        <div className="analysis-form-section">
          <h2>채팅방 분석</h2>
          
          {/* 입력 모드 선택 */}
          <div className="input-mode-selector">
            <button
              type="button"
              className={`mode-btn ${inputMode === 'code' ? 'active' : ''}`}
              onClick={() => setInputMode('code')}
            >
              📝 코드로 분석
            </button>
            <button
              type="button"
              className={`mode-btn ${inputMode === 'url' ? 'active' : ''}`}
              onClick={() => setInputMode('url')}
            >
              🔗 URL로 분석
            </button>
          </div>

          <form onSubmit={handleAnalyze} className="analysis-form">
            {inputMode === 'code' ? (
              <div className="form-group">
                <label>채팅방 코드</label>
                <p className="form-help">
                  학생이 생성한 채팅방의 고유 코드를 입력하세요.
                </p>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="예: ABC123"
                  maxLength={6}
                  required
                  style={{ 
                    textTransform: 'uppercase',
                    fontFamily: 'monospace',
                    fontSize: '1.2rem',
                    letterSpacing: '0.2rem',
                    textAlign: 'center'
                  }}
                />
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>채팅방 URL 또는 ID</label>
                  <input
                    type="text"
                    value={chatUrl}
                    onChange={(e) => setChatUrl(e.target.value)}
                    placeholder="예: /chat/rooms/1 또는 1"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>채팅방 이름 (선택사항)</label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="채팅방 이름"
                  />
                </div>
              </>
            )}
            <button type="submit" className="analyze-btn" disabled={loading}>
              {loading ? '분석 중...' : '분석 시작'}
            </button>
          </form>

          {error && <div className="error-message">{error}</div>}
        </div>

        {analysis && analysis.analysis && (
          <div className="analysis-results">
            <div className="analysis-header">
              <h2>분석 결과: {analysis.roomName}</h2>
              {analysis.roomCode && (
                <div className="room-code-display">
                  <span className="code-label">채팅방 코드:</span>
                  <span className="code-value">{analysis.roomCode}</span>
                </div>
              )}
            </div>

            {/* 전체 통계 */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">전체 메시지</div>
                <div className="stat-value">{analysis.analysis.totalMessages}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">유의미한 메시지</div>
                <div className="stat-value">{analysis.analysis.relevantMessages}</div>
                <div className="stat-sub">
                  {analysis.analysis.totalMessages > 0
                    ? Math.round((analysis.analysis.relevantMessages / analysis.analysis.totalMessages) * 100)
                    : 0}%
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">평균 유의미함 점수</div>
                <div className="stat-value">
                  {Math.round(analysis.analysis.averageRelevance)}/100
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">쓸모없는 메시지</div>
                <div className="stat-value">{analysis.analysis.irrelevantMessages}</div>
              </div>
            </div>

            {/* 키워드 */}
            {analysis.analysis.topKeywords && analysis.analysis.topKeywords.length > 0 && (
              <div className="keywords-section">
                <h3>🔑 주요 키워드</h3>
                <div className="keywords-list">
                  {analysis.analysis.topKeywords.map((item, index) => (
                    <div key={index} className="keyword-item">
                      <span className="keyword-rank">#{index + 1}</span>
                      <span className="keyword-text">{item.keyword}</span>
                      <span className="keyword-count">{item.count}회</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 조원별 기여도 */}
            {analysis.analysis.userContributions && Object.keys(analysis.analysis.userContributions).length > 0 && (
              <div className="contributions-section">
                <h3>👥 조원별 기여도</h3>
                <div className="contributions-list">
                  {Object.entries(analysis.analysis.userContributions)
                    .sort((a, b) => b[1].contributionScore - a[1].contributionScore)
                    .map(([userName, contribution]) => (
                      <div key={userName} className="contribution-card">
                        <div className="contribution-header">
                          <span className="user-name">{userName}</span>
                          <span className="contribution-score">
                            기여도: {Math.round(contribution.contributionScore)}/100
                          </span>
                        </div>
                        <div className="contribution-details">
                          <div className="detail-item">
                            <span>메시지 수:</span>
                            <span>{contribution.messageCount}개</span>
                          </div>
                          <div className="detail-item">
                            <span>평균 유의미함:</span>
                            <span>{Math.round(contribution.averageRelevance)}/100</span>
                          </div>
                        </div>
                        {contribution.keywords && Object.keys(contribution.keywords).length > 0 && (
                          <div className="user-keywords">
                            <strong>주요 키워드:</strong>
                            {Object.entries(contribution.keywords)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 5)
                              .map(([keyword]) => (
                                <span key={keyword} className="user-keyword-tag">{keyword}</span>
                              ))}
                          </div>
                        )}
                        <div className="contribution-bar">
                          <div
                            className="contribution-fill"
                            style={{ width: `${contribution.contributionScore}%` }}
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 메시지 분류 */}
            <div className="classification-section">
              <h3>📋 메시지 분류</h3>
              <div className="classification-stats">
                <div className="classification-item highly-relevant">
                  <span className="class-label">매우 유의미</span>
                  <span className="class-count">{analysis.analysis.highlyRelevantMessages || 0}</span>
                </div>
                <div className="classification-item relevant">
                  <span className="class-label">유의미</span>
                  <span className="class-count">{analysis.analysis.relevantMessages || 0}</span>
                </div>
                <div className="classification-item neutral">
                  <span className="class-label">중립</span>
                  <span className="class-count">{analysis.analysis.neutralMessages || 0}</span>
                </div>
                <div className="classification-item irrelevant">
                  <span className="class-label">쓸모없음</span>
                  <span className="class-count">{analysis.analysis.irrelevantMessages || 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalysisDashboard
