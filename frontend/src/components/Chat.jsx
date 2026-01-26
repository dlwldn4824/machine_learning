import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import ScheduleModal from './ScheduleModal'
import './Chat.css'

function Chat({ user: propUser, onScheduleCreate, onTodoCreate }) {
  const [rooms, setRooms] = useState([])
  const [currentRoom, setCurrentRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState(null)
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [inviteChatId, setInviteChatId] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [invitedMembers, setInvitedMembers] = useState([])
  const [showPlusMenu, setShowPlusMenu] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showTodoForm, setShowTodoForm] = useState(false)
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [categories, setCategories] = useState([])
  const socketRef = useRef(null)
  const messagesEndRef = useRef(null)
  const plusMenuRef = useRef(null)

  useEffect(() => {
    // 로그인한 사용자 정보 가져오기
    const savedUser = propUser || JSON.parse(localStorage.getItem('user') || '{}')
    setUser(savedUser)

    fetchRooms()
    fetchCategories()
    
    // Socket.io 연결
    socketRef.current = io('http://localhost:5001')
    
    socketRef.current.on('receive-message', (data) => {
      setMessages(prev => [...prev, data])
    })

    // 외부 클릭 시 플러스 메뉴 닫기
    const handleClickOutside = (event) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target)) {
        setShowPlusMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  useEffect(() => {
    if (currentRoom && socketRef.current) {
      socketRef.current.emit('join-room', currentRoom.id)
      fetchMessages(currentRoom.id)
    }

    return () => {
      if (currentRoom && socketRef.current) {
        socketRef.current.emit('leave-room', currentRoom.id)
      }
    }
  }, [currentRoom])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/chat/rooms')
      const data = await response.json()
      setRooms(data)
      if (data.length > 0 && !currentRoom) {
        setCurrentRoom(data[0])
      }
    } catch (error) {
      console.error('채팅방 조회 실패:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      const data = await response.json()
      setCategories(data)
    } catch (error) {
      console.error('카테고리 조회 실패:', error)
    }
  }

  const fetchMessages = async (roomId) => {
    try {
      const response = await fetch(`/api/chat/rooms/${roomId}/messages`)
      const data = await response.json()
      setMessages(data)
    } catch (error) {
      console.error('메시지 조회 실패:', error)
    }
  }

  const handleSearchUsers = async (chatId) => {
    if (!chatId || chatId.trim().length < 2) {
      setSearchResults([])
      return
    }

    try {
      const response = await fetch(`/api/users/search/${chatId}`)
      const data = await response.json()
      setSearchResults(data.filter(u => u.id !== user?.id)) // 자신 제외
    } catch (error) {
      console.error('사용자 검색 실패:', error)
    }
  }

  const handleInviteUser = (userToInvite) => {
    if (!invitedMembers.find(m => m.user_id === userToInvite.id)) {
      setInvitedMembers([...invitedMembers, {
        user_id: userToInvite.id,
        chat_id: userToInvite.chat_id,
        name: userToInvite.name
      }])
    }
    setInviteChatId('')
    setSearchResults([])
  }

  const handleRemoveInvite = (userId) => {
    setInvitedMembers(invitedMembers.filter(m => m.user_id !== userId))
  }

  const handleCreateRoom = async (e) => {
    e.preventDefault()
    if (!newRoomName.trim()) {
      alert('채팅방 이름을 입력해주세요.')
      return
    }

    if (!user || !user.chat_id) {
      alert('마이페이지에서 채팅 ID를 먼저 설정해주세요.')
      return
    }

    try {
      const response = await fetch('/api/chat/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoomName,
          type: 'team',
          creator_id: user.id,
          creator_chat_id: user.chat_id,
          member_ids: invitedMembers
        })
      })

      if (response.ok) {
        const newRoom = await response.json()
        setRooms([...rooms, newRoom])
        setCurrentRoom(newRoom)
        setShowCreateRoomModal(false)
        
        // 생성된 채팅방 코드 표시
        if (newRoom.code) {
          alert(`채팅방이 생성되었습니다!\n\n채팅방 코드: ${newRoom.code}\n\n이 코드를 교수님께 공유하시면 분석 대시보드에서 확인할 수 있습니다.`)
        }
        
        setNewRoomName('')
        setInvitedMembers([])
        setInviteChatId('')
      } else {
        const error = await response.json()
        alert(error.error || '채팅방 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('채팅방 생성 실패:', error)
      alert('채팅방 생성 중 오류가 발생했습니다.')
    }
  }

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !user || !currentRoom) return

    const messageData = {
      roomId: currentRoom.id,
      userName: user.chat_id || user.name,
      message: newMessage
    }

    socketRef.current.emit('send-message', messageData)
    setNewMessage('')
  }

  const handleCreateTodo = async () => {
    if (!newTodoTitle.trim()) return

    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodoTitle })
      })

      if (response.ok) {
        setNewTodoTitle('')
        setShowTodoForm(false)
        setShowPlusMenu(false)
        if (onTodoCreate) onTodoCreate()
        
        const messageData = {
          roomId: currentRoom.id,
          userName: user.chat_id || user.name,
          message: `📝 Todo 생성: ${newTodoTitle}`
        }
        socketRef.current.emit('send-message', messageData)
      }
    } catch (error) {
      console.error('Todo 생성 실패:', error)
    }
  }

  const handleScheduleCreate = () => {
    setShowScheduleModal(true)
    setShowPlusMenu(false)
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  // 채팅 리스트 화면 렌더링 함수
  const renderChatList = () => (
    <div className="chat-list-view">
      <div className="chat-list-header">
        <h2>💬 채팅</h2>
        <button
          className="create-room-btn"
          onClick={() => {
            if (!user || !user.chat_id) {
              alert('마이페이지에서 채팅 ID를 먼저 설정해주세요.')
              return
            }
            setShowCreateRoomModal(true)
          }}
        >
          + 새 채팅 만들기
        </button>
      </div>

      <div className="rooms-list-view">
        {rooms.length === 0 ? (
          <div className="empty-rooms">
            <p>채팅방이 없습니다.</p>
            <p>새 채팅을 만들어보세요!</p>
          </div>
        ) : (
          rooms.map(room => (
            <div
              key={room.id}
              className="room-list-item"
              onClick={() => setCurrentRoom(room)}
            >
              <div className="room-list-icon">💬</div>
              <div className="room-list-info">
                <div className="room-list-name">{room.name}</div>
                <div className="room-list-type">{room.type}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )

  // 채팅 리스트 화면 (채팅방이 없거나 선택되지 않은 경우)
  if (!currentRoom || rooms.length === 0) {
    return (
      <div className="chat-container-wireframe">
        {renderChatList()}

        {/* 새 채팅 만들기 모달 */}
        {showCreateRoomModal && (
          <div className="modal-overlay" onClick={() => setShowCreateRoomModal(false)}>
            <div className="modal-content create-room-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>새 채팅 만들기</h2>
                <button className="close-btn" onClick={() => setShowCreateRoomModal(false)}>×</button>
              </div>
              <form onSubmit={handleCreateRoom} className="create-room-form">
                <div className="form-group">
                  <label>채팅방 이름</label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="예: 프로젝트 팀"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>팀원 초대 (채팅 ID로 검색)</label>
                  <p className="form-help">
                    채팅방 생성 시 고유한 코드가 자동으로 생성됩니다. 이 코드를 교수님께 공유하세요.
                  </p>
                  <input
                    type="text"
                    value={inviteChatId}
                    onChange={(e) => {
                      setInviteChatId(e.target.value)
                      handleSearchUsers(e.target.value)
                    }}
                    placeholder="채팅 ID 입력..."
                  />
                  {searchResults.length > 0 && (
                    <div className="search-results">
                      {searchResults.map(user => (
                        <div
                          key={user.id}
                          className="search-result-item"
                          onClick={() => handleInviteUser(user)}
                        >
                          <span>{user.name}</span>
                          <span className="chat-id-badge">{user.chat_id}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {invitedMembers.length > 0 && (
                  <div className="invited-members">
                    <label>초대된 팀원</label>
                    <div className="member-tags">
                      {invitedMembers.map(member => (
                        <div key={member.user_id} className="member-tag">
                          <span>{member.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveInvite(member.user_id)}
                            className="remove-member-btn"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-actions">
                  <button type="submit" className="submit-btn">생성</button>
                  <button
                    type="button"
                    className="cancel-btn"
                    onClick={() => {
                      setShowCreateRoomModal(false)
                      setNewRoomName('')
                      setInvitedMembers([])
                      setInviteChatId('')
                    }}
                  >
                    취소
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // 상단 그룹 채팅 버튼들 (최대 3개)
  const topRooms = rooms.slice(0, 3)

  return (
    <div className="chat-container-wireframe">
      {/* 상단 그룹 채팅 버튼들 */}
      <div className="chat-top-rooms">
        {topRooms.map((room, index) => (
          <button
            key={room.id}
            className={`group-chat-top-btn ${currentRoom?.id === room.id ? 'active' : ''}`}
            onClick={() => setCurrentRoom(room)}
          >
            단톡{index + 1}
          </button>
        ))}
        {topRooms.length < 3 && (
          <>
            {Array.from({ length: 3 - topRooms.length }).map((_, index) => (
              <button key={`empty-${index}`} className="group-chat-top-btn disabled" disabled>
                단톡{topRooms.length + index + 1}
              </button>
            ))}
          </>
        )}
      </div>

      {/* 채팅방 헤더 (목록 보기 버튼 포함) */}
      {currentRoom && (
        <div className="chat-room-header">
          <button
            className="back-to-list-btn"
            onClick={() => setCurrentRoom(null)}
          >
            ← 목록
          </button>
          <h3>{currentRoom.name}</h3>
        </div>
      )}

      {/* 메인 채팅 영역 */}
      <div className="chat-main-wireframe">
        {currentRoom && (
          <>
            <div className="messages-container-wireframe">
              {messages.length === 0 ? (
                <div className="empty-chat">
                  <p>채팅을 시작해보세요! 💬</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isOwn = msg.user_name === (user?.chat_id || user?.name)
                  return (
                    <div
                      key={index}
                      className={`message-wireframe ${isOwn ? 'own' : ''}`}
                    >
                      {!isOwn && (
                        <div className="message-avatar">
                          {msg.user_name.charAt(0)}
                        </div>
                      )}
                      <div className="message-content-wrapper">
                        {!isOwn && (
                          <div className="message-user-name">{msg.user_name}</div>
                        )}
                        <div className="message-bubble">
                          {msg.message}
                        </div>
                        <div className="message-time">{formatTime(msg.created_at)}</div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 하단 입력 영역 */}
            <div className="chat-input-area">
              {/* + 버튼과 플러스 메뉴 */}
              <div className="plus-button-wrapper" ref={plusMenuRef}>
                <button
                  className="plus-button"
                  onClick={() => setShowPlusMenu(!showPlusMenu)}
                >
                  +
                </button>
                {showPlusMenu && (
                  <div className="plus-menu">
                    <button className="plus-menu-item" onClick={handleScheduleCreate}>
                      📅 일정짜기
                    </button>
                    <button className="plus-menu-item" onClick={() => {
                      setShowTodoForm(true)
                      setShowPlusMenu(false)
                    }}>
                      📝 Todo 만들기
                    </button>
                    <button className="plus-menu-item">
                      📷 사진 공유
                    </button>
                    <button className="plus-menu-item">
                      📎 파일 공유
                    </button>
                  </div>
                )}
              </div>

              {/* Todo 생성 폼 */}
              {showTodoForm && (
                <div className="todo-form-inline">
                  <input
                    type="text"
                    placeholder="Todo 제목 입력..."
                    value={newTodoTitle}
                    onChange={(e) => setNewTodoTitle(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleCreateTodo()
                      }
                    }}
                    autoFocus
                  />
                  <button onClick={handleCreateTodo}>추가</button>
                  <button onClick={() => {
                    setShowTodoForm(false)
                    setNewTodoTitle('')
                  }}>취소</button>
                </div>
              )}

              {/* 메시지 입력 */}
              {!showTodoForm && (
                <form onSubmit={handleSendMessage} className="message-input-form-wireframe">
                  <input
                    type="text"
                    placeholder="메시지를 입력하세요..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <button type="submit" disabled={!newMessage.trim()}>
                    전송
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>

      {/* 일정 생성 모달 */}
      {showScheduleModal && (
        <ScheduleModal
          date={new Date()}
          schedule={null}
          categories={categories}
          onClose={() => {
            setShowScheduleModal(false)
            if (onScheduleCreate) onScheduleCreate()
          }}
          onDelete={() => {}}
          onRefresh={() => {
            if (onScheduleCreate) onScheduleCreate()
          }}
        />
      )}
    </div>
  )
}

export default Chat
