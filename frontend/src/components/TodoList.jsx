import { useState, useEffect } from 'react'
import './TodoList.css'

function TodoList() {
  const [todos, setTodos] = useState([])
  const [categories, setCategories] = useState([])
  const [newTodo, setNewTodo] = useState({ title: '', category_id: '' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [addingToCategory, setAddingToCategory] = useState(null)

  useEffect(() => {
    fetchTodos()
    fetchCategories()
  }, [])

  const fetchTodos = async () => {
    try {
      const response = await fetch('/api/todos')
      const data = await response.json()
      setTodos(data)
    } catch (error) {
      console.error('Todo 조회 실패:', error)
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

  const handleAddTodo = async (e) => {
    e.preventDefault()
    if (!newTodo.title.trim()) return

    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTodo)
      })

      if (response.ok) {
        setNewTodo({ title: '', category_id: '' })
        setShowAddForm(false)
        setAddingToCategory(null)
        fetchTodos()
      }
    } catch (error) {
      console.error('Todo 추가 실패:', error)
    }
  }

  const handleToggleTodo = async (id) => {
    try {
      await fetch(`/api/todos/${id}/toggle`, { method: 'PATCH' })
      fetchTodos()
    } catch (error) {
      console.error('Todo 상태 변경 실패:', error)
    }
  }

  const handleDeleteTodo = async (id) => {
    if (!confirm('Todo를 삭제하시겠습니까?')) return

    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' })
      fetchTodos()
    } catch (error) {
      console.error('Todo 삭제 실패:', error)
    }
  }

  const handleAddToCategory = (categoryId) => {
    setAddingToCategory(categoryId)
    setNewTodo({ title: '', category_id: categoryId })
    setShowAddForm(true)
  }

  const getCategoryIcon = (categoryName) => {
    const iconMap = {
      '업무': '💼',
      '개인': '👤',
      '학습': '📚',
      '운동': '💪',
      '바른 섭취': '🛒',
      '신체 강화': '💪',
      '읽고 쓰기': '✍️'
    }
    return iconMap[categoryName] || '📝'
  }

  // 카테고리별로 Todo 그룹화
  const todosByCategory = categories.map(category => ({
    category,
    todos: todos.filter(todo => 
      todo.category_id === category.id && !todo.is_completed
    )
  })).filter(group => group.todos.length > 0)

  // 카테고리가 없는 Todo들
  const todosWithoutCategory = todos.filter(todo => 
    !todo.category_id && !todo.is_completed
  )

  return (
    <div className="todo-list-container-home">
      <div className="todo-header-home">
        <h2>일정이 확정되지 않은 todolist</h2>
        <button 
          className="add-btn-header"
          onClick={() => {
            setShowAddForm(!showAddForm)
            setAddingToCategory(null)
            setNewTodo({ title: '', category_id: '' })
          }}
          title="Todo 추가"
        >
          {showAddForm ? '−' : '+'}
        </button>
      </div>

      {/* 카테고리별 Todo 그룹 */}
      <div className="todos-by-category">
        {todosByCategory.map(({ category, todos: categoryTodos }) => (
          <div key={category.id} className="category-group">
            <div className="category-header">
              <div className="category-title">
                <span className="category-icon">{getCategoryIcon(category.name)}</span>
                <span className="category-name">{category.name}</span>
                {/* 조정 불가능한 카테고리는 잠금 아이콘 표시 (예시) */}
                {category.name === '바른 섭취' && (
                  <span className="lock-icon">🔒</span>
                )}
              </div>
              <button
                className="category-add-btn"
                onClick={() => handleAddToCategory(category.id)}
                title={`${category.name}에 Todo 추가`}
              >
                +
              </button>
            </div>
            <div className="category-todos">
              {categoryTodos.map(todo => (
                <div key={todo.id} className="todo-item-category">
                  <input
                    type="checkbox"
                    checked={todo.is_completed === 1}
                    onChange={() => handleToggleTodo(todo.id)}
                  />
                  <span className="todo-title-category">{todo.title}</span>
                  <button
                    className="todo-menu-btn"
                    onClick={() => {
                      // 세 점 메뉴 기능 (추후 구현)
                      console.log('Todo 메뉴:', todo.id)
                    }}
                  >
                    ⋯
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 카테고리가 없는 Todo들 */}
        {todosWithoutCategory.length > 0 && (
          <div className="category-group">
            <div className="category-header">
              <div className="category-title">
                <span className="category-icon">📝</span>
                <span className="category-name">기타</span>
              </div>
            </div>
            <div className="category-todos">
              {todosWithoutCategory.map(todo => (
                <div key={todo.id} className="todo-item-category">
                  <input
                    type="checkbox"
                    checked={todo.is_completed === 1}
                    onChange={() => handleToggleTodo(todo.id)}
                  />
                  <span className="todo-title-category">{todo.title}</span>
                  <button
                    className="todo-menu-btn"
                    onClick={() => handleDeleteTodo(todo.id)}
                  >
                    ⋯
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {todosByCategory.length === 0 && todosWithoutCategory.length === 0 && (
          <div className="empty-state-home">
            <p>할 일이 없습니다. 새로운 할 일을 추가해보세요!</p>
            <button
              className="add-btn-empty"
              onClick={() => {
                setShowAddForm(true)
                setAddingToCategory(null)
                setNewTodo({ title: '', category_id: '' })
              }}
            >
              + Todo 추가하기
            </button>
          </div>
        )}
      </div>

      {/* Todo 추가 폼 */}
      {showAddForm && (
        <div className="todo-add-form-overlay">
          <form onSubmit={handleAddTodo} className="todo-add-form">
            <div className="form-header">
              <h3>
                {addingToCategory 
                  ? `${categories.find(c => c.id === addingToCategory)?.name || ''}에 Todo 추가`
                  : '새 Todo 추가'}
              </h3>
              <button
                type="button"
                className="close-form-btn"
                onClick={() => {
                  setShowAddForm(false)
                  setAddingToCategory(null)
                  setNewTodo({ title: '', category_id: '' })
                }}
              >
                ×
              </button>
            </div>
            <input
              type="text"
              placeholder="할 일을 입력하세요..."
              value={newTodo.title}
              onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
              autoFocus
            />
            {!addingToCategory && (
              <select
                value={newTodo.category_id}
                onChange={(e) => setNewTodo({ ...newTodo, category_id: e.target.value })}
              >
                <option value="">카테고리 선택</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            )}
            <div className="form-actions">
              <button type="submit" className="submit-btn">추가</button>
              <button 
                type="button" 
                className="cancel-btn"
                onClick={() => {
                  setShowAddForm(false)
                  setAddingToCategory(null)
                  setNewTodo({ title: '', category_id: '' })
                }}
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default TodoList
