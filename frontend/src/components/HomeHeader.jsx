import { useState } from 'react'
import './HomeHeader.css'

function HomeHeader({ onChatRoomClick, chatRooms }) {
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e) => {
    e.preventDefault()
    // 검색 기능 구현
    console.log('검색:', searchQuery)
  }

  return (
    <div className="home-header">
      <div className="header-left">
        <div className="profile-avatar">
          <span>👤</span>
        </div>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="메시지 입력 또는 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </form>
      </div>
      <div className="header-right">
        {chatRooms.slice(0, 3).map((room, index) => (
          <button
            key={room.id}
            className="group-chat-btn"
            onClick={() => onChatRoomClick(room)}
            title={room.name}
          >
            단톡{index + 1}
          </button>
        ))}
        {chatRooms.length === 0 && (
          <>
            <button className="group-chat-btn disabled">단톡1</button>
            <button className="group-chat-btn disabled">단톡2</button>
            <button className="group-chat-btn disabled">단톡3</button>
          </>
        )}
      </div>
    </div>
  )
}

export default HomeHeader
