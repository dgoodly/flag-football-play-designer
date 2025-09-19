'use client'

import { useEffect, useRef, useState } from 'react'

interface Point {
  x: number
  y: number
}

interface Path {
  points: Point[]
}

interface Formation {
  center: { top: number }
  qb: { top: number }
  wr1: { left: number; top: number }
  wr2: { left: number; top: number }
  wr3: { left: number; top: number }
  wr4: { left: number; top: number }
}

// Formation positions as percentages of canvas dimensions
const getFormations = (canvasWidth: number, canvasHeight: number): Record<string, Formation> => ({
  gunEmptyBunch: {
    center: { top: canvasHeight * 0.64 },
    qb: { top: canvasHeight * 0.81 },
    wr1: { left: canvasWidth * 0.70, top: canvasHeight * 0.69 },
    wr2: { left: canvasWidth * 0.75, top: canvasHeight * 0.64 },
    wr3: { left: canvasWidth * 0.80, top: canvasHeight * 0.69 },
    wr4: { left: canvasWidth * 0.21, top: canvasHeight * 0.64 }
  },
  gunEmptyAce: {
    center: { top: canvasHeight * 0.64 },
    qb: { top: canvasHeight * 0.81 },
    wr1: { left: canvasWidth * 0.14, top: canvasHeight * 0.64 },
    wr2: { left: canvasWidth * 0.31, top: canvasHeight * 0.64 },
    wr3: { left: canvasWidth * 0.66, top: canvasHeight * 0.64 },
    wr4: { left: canvasWidth * 0.83, top: canvasHeight * 0.64 }
  }
})

export default function FlagFootballDesigner() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const playersContainerRef = useRef<HTMLDivElement>(null)
  const eraserCursorRef = useRef<HTMLDivElement>(null)
  
  const [drawing, setDrawing] = useState(true)
  const [erasing, setErasing] = useState(false)
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [drawingHistory, setDrawingHistory] = useState<Path[]>([])
  const [currentPath, setCurrentPath] = useState<Path | null>(null)
  const [selectedFormation, setSelectedFormation] = useState('gunEmptyBunch')
  const [canvasSize, setCanvasSize] = useState({ width: 1920, height: 1080 })
  const [colorPalette, setColorPalette] = useState<{ show: boolean; playerId: string; x: number; y: number } | null>(null)
  const [playerColors, setPlayerColors] = useState<Record<string, string>>({})
  const [isDragging, setIsDragging] = useState(false)
  
  const snapGrid = 30
  const players = useRef<Record<string, HTMLDivElement>>({})
  const isDraggingRef = useRef(false)

  // Calculate responsive canvas size
  const calculateCanvasSize = () => {
    if (typeof window === 'undefined') return { width: 1920, height: 1080 }
    
    const maxWidth = Math.min(window.innerWidth - 40, 1920) // 40px for padding
    const maxHeight = Math.min(window.innerHeight - 200, 1080) // 200px for controls
    
    // Maintain 16:9 aspect ratio
    const aspectRatio = 16 / 9
    let width = maxWidth
    let height = width / aspectRatio
    
    if (height > maxHeight) {
      height = maxHeight
      width = height * aspectRatio
    }
    
    return { width: Math.floor(width), height: Math.floor(height) }
  }

  // Get canvas position from event
  const getCanvasPos = (e: MouseEvent | TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    
    const rect = canvasRef.current.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }
  }

  // Snap to grid helper
  const snap = (value: number) => {
    return Math.round(value / snapGrid) * snapGrid
  }

  // Smooth path helper
  const smoothPath = (points: Point[]): Point[] => {
    if (points.length < 3) return points
    const smoothed = [points[0]]

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const next = points[i + 1]

      const mx = (prev.x + curr.x + next.x) / 3
      const my = (prev.y + curr.y + next.y) / 3
      smoothed.push({ x: mx, y: my })
    }

    smoothed.push(points[points.length - 1])
    return smoothed
  }

  // Straighten path helper - only straightens very close to cardinal directions
  const straightenPath = (points: Point[], tolerance = 3): Point[] => {
    if (points.length < 2) return points

    const start = points[0]
    const end = points[points.length - 1]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)

    // Only snap to cardinal directions (0, 90, 180, 270) for cleaner routes
    const snapAngles = [0, 90, 180, 270]
    let closest = snapAngles[0]
    let minDiff = Math.abs(angle - snapAngles[0])
    
    for (let a of snapAngles) {
      const diff = Math.abs(angle - a)
      if (diff < minDiff) {
        minDiff = diff
        closest = a
      }
    }

    // Only straighten if very close to a cardinal direction
    if (minDiff <= tolerance) {
      const radians = closest * Math.PI / 180
      const distance = Math.sqrt(dx * dx + dy * dy)
      const newPoints: Point[] = []
      
      for (let i = 0; i <= points.length - 1; i++) {
        const t = i / (points.length - 1)
        newPoints.push({
          x: start.x + t * distance * Math.cos(radians),
          y: start.y + t * distance * Math.sin(radians)
        })
      }
      return newPoints
    }

    return points
  }

  // Create player element
  const createPlayer = (id: string, text: string, className: string) => {
    if (!playersContainerRef.current) return null
    
    const div = document.createElement('div')
    div.id = id
    div.className = `player ${className}`
    div.innerText = text
    
    // Preserve existing position if player already exists
    const existingPlayer = players.current[id]
    if (existingPlayer) {
      div.style.left = existingPlayer.style.left
      div.style.top = existingPlayer.style.top
    } else {
      div.style.left = `${canvasSize.width / 2 - 30}px`
      div.style.top = '0px'
    }
    
    // Apply color if set
    if (playerColors[id]) {
      div.style.backgroundColor = playerColors[id]
    }
    
    playersContainerRef.current.appendChild(div)
    makeDraggable(div)
    
    // Add click handler for color palette
    div.addEventListener('click', (e) => {
      e.stopPropagation()
      // Only show color picker if we're not dragging
      if (!isDraggingRef.current) {
        const rect = div.getBoundingClientRect()
        const canvasRect = canvasRef.current?.getBoundingClientRect()
        if (canvasRect) {
          const x = rect.left - canvasRect.left + rect.width / 2
          const y = rect.bottom - canvasRect.top + 10
          showColorPalette(id, x, y)
        }
      }
    })
    
    return div
  }

  // Make element draggable
  const makeDraggable = (element: HTMLDivElement) => {
    if (element.id === 'center') return

    let offsetX: number, offsetY: number
    let startX: number, startY: number
    let hasMoved = false

    const startDrag = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      offsetX = clientX - element.offsetLeft
      offsetY = clientY - element.offsetTop
      startX = clientX
      startY = clientY
      hasMoved = false

      const dragHandler = 'touches' in e ? 'touchmove' : 'mousemove'
      const dropHandler = 'touches' in e ? 'touchend' : 'mouseup'

      document.addEventListener(dragHandler, drag)
      document.addEventListener(dropHandler, drop)
    }

    const drag = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

      // Check if we've moved enough to consider it a drag
      const deltaX = Math.abs(clientX - startX)
      const deltaY = Math.abs(clientY - startY)
      if (deltaX > 5 || deltaY > 5) {
        hasMoved = true
        setIsDragging(true)
        isDraggingRef.current = true
      }

      let x = snap(clientX - offsetX)
      let y = snap(clientY - offsetY)

      // QB stays horizontally centered
      if (element.id === 'qb') {
        x = canvasSize.width / 2 - element.offsetWidth / 2
      }

      // Prevent going above center player
      if (players.current.center && y < players.current.center.offsetTop) {
        y = players.current.center.offsetTop
      }

      element.style.left = `${x}px`
      element.style.top = `${y}px`
    }

    const drop = () => {
      document.removeEventListener('mousemove', drag)
      document.removeEventListener('mouseup', drop)
      document.removeEventListener('touchmove', drag)
      document.removeEventListener('touchend', drop)
      
      // Auto-switch to Custom when player is moved
      if (selectedFormation !== 'custom') {
        setSelectedFormation('custom')
      }
      
      // Reset drag state after a short delay
      setTimeout(() => {
        setIsDragging(false)
        isDraggingRef.current = false
      }, 100)
    }

    element.addEventListener('mousedown', startDrag)
    element.addEventListener('touchstart', startDrag, { passive: false })
  }

  // Set formation
  const setFormation = (name: string) => {
    const formations = getFormations(canvasSize.width, canvasSize.height)
    const f = formations[name]
    if (!f || name === 'custom') return

    if (players.current.center) {
      players.current.center.style.top = `${f.center.top}px`
      players.current.center.style.left = `${canvasSize.width / 2 - 30}px`
    }

    if (players.current.qb) {
      players.current.qb.style.top = `${f.qb.top}px`
      players.current.qb.style.left = `${canvasSize.width / 2 - 30}px`
    }

    if (players.current.wr1) {
      players.current.wr1.style.top = `${f.wr1.top}px`
      players.current.wr1.style.left = `${f.wr1.left}px`
    }

    if (players.current.wr2) {
      players.current.wr2.style.top = `${f.wr2.top}px`
      players.current.wr2.style.left = `${f.wr2.left}px`
    }

    if (players.current.wr3) {
      players.current.wr3.style.top = `${f.wr3.top}px`
      players.current.wr3.style.left = `${f.wr3.left}px`
    }

    if (players.current.wr4) {
      players.current.wr4.style.top = `${f.wr4.top}px`
      players.current.wr4.style.left = `${f.wr4.left}px`
    }
  }

  // Flip formation around the vertical center of the canvas
  const flipFormation = () => {
    if (!players.current.wr1 || !players.current.wr2 || !players.current.wr3 || !players.current.wr4) return

    // Get current positions
    const wr1Left = parseInt(players.current.wr1.style.left)
    const wr1Top = parseInt(players.current.wr1.style.top)
    const wr2Left = parseInt(players.current.wr2.style.left)
    const wr2Top = parseInt(players.current.wr2.style.top)
    const wr3Left = parseInt(players.current.wr3.style.left)
    const wr3Top = parseInt(players.current.wr3.style.top)
    const wr4Left = parseInt(players.current.wr4.style.left)
    const wr4Top = parseInt(players.current.wr4.style.top)

    // Calculate the vertical center line of the canvas
    const centerX = canvasSize.width / 2
    const playerWidth = 60 // Player width in pixels

    // Mirror positions around the vertical center line, accounting for player width
    const mirrorPosition = (left: number) => {
      // Calculate the center point of the current player
      const playerCenter = left + (playerWidth / 2)
      // Calculate distance from canvas center
      const distanceFromCenter = playerCenter - centerX
      // Mirror the center point
      const mirroredCenter = centerX - distanceFromCenter
      // Return the left position for the mirrored player
      return mirroredCenter - (playerWidth / 2)
    }

    // Apply mirrored positions (only horizontal mirroring, keep vertical positions)
    players.current.wr1.style.left = `${mirrorPosition(wr1Left)}px`
    players.current.wr1.style.top = `${wr1Top}px`
    
    players.current.wr2.style.left = `${mirrorPosition(wr2Left)}px`
    players.current.wr2.style.top = `${wr2Top}px`
    
    players.current.wr3.style.left = `${mirrorPosition(wr3Left)}px`
    players.current.wr3.style.top = `${wr3Top}px`
    
    players.current.wr4.style.left = `${mirrorPosition(wr4Left)}px`
    players.current.wr4.style.top = `${wr4Top}px`

    // Auto-switch to Custom since formation has been modified
    setSelectedFormation('custom')
  }

  // Show color palette for a player
  const showColorPalette = (playerId: string, x: number, y: number) => {
    setColorPalette({ show: true, playerId, x, y })
  }

  // Hide color palette
  const hideColorPalette = () => {
    setColorPalette(null)
  }

  // Change player color
  const changePlayerColor = (playerId: string, color: string) => {
    setPlayerColors(prev => ({ ...prev, [playerId]: color }))
    hideColorPalette()
  }

  // Available colors
  const colors = [
    { name: 'red', value: '#ff4444' },
    { name: 'blue', value: '#4444ff' },
    { name: 'yellow', value: '#ffff44' },
    { name: 'purple', value: '#aa44aa' }
  ]

  // Redraw canvas
  const redrawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw 30x30 grid (invisible)
    ctx.strokeStyle = 'rgba(255,255,255,0)'
    ctx.lineWidth = 1
    for (let x = 0; x <= canvas.width; x += snapGrid) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    for (let y = 0; y <= canvas.height; y += snapGrid) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Draw horizontal field lines first
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 4
    const lineSpacing = 180.5
    const fieldLineYs: number[] = []
    for (let y = 0; y <= canvas.height; y += lineSpacing) {
      fieldLineYs.push(y)
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    // Draw hashmarks (skip those that overlap with field lines)
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    const hashWidth = 35
    const hashHeight = 4
    const verticalSpacing = 36

    // Helper function to check if Y coordinate is near a field line
    const isNearFieldLine = (y: number) => {
      return fieldLineYs.some(fieldY => Math.abs(y - fieldY) < 10)
    }

    // First set: near edges
    const leftOffset1 = 0
    const rightOffset1 = canvas.width - hashWidth
    for (let y = 0; y < canvas.height; y += verticalSpacing) {
      if (!isNearFieldLine(y)) {
        ctx.fillRect(leftOffset1, y, hashWidth, hashHeight)
        ctx.fillRect(rightOffset1, y, hashWidth, hashHeight)
      }
    }

    // Second set: equidistant from center (hashmarks at 20% from center)
    const centerX = canvas.width / 2
    const hashDistanceFromCenter = canvas.width * 0.20
    const leftOffset2 = centerX - hashDistanceFromCenter
    const rightOffset2 = centerX + hashDistanceFromCenter - hashWidth
    for (let y = 0; y < canvas.height; y += verticalSpacing) {
      if (!isNearFieldLine(y)) {
        ctx.fillRect(leftOffset2, y, hashWidth, hashHeight)
        ctx.fillRect(rightOffset2, y, hashWidth, hashHeight)
      }
    }

    // Draw all user paths
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 6

    drawingHistory.forEach(path => {
      ctx.beginPath()
      path.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.stroke()
    })

    // Draw current path being drawn (for real-time feedback)
    if (currentPath && currentPath.points.length > 1) {
      ctx.beginPath()
      currentPath.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.stroke()
    }
  }

  // Drawing functions
  const startDrawing = (e: MouseEvent | TouchEvent) => {
    if (!drawing) return
    setIsMouseDown(true)
    const pos = getCanvasPos(e)
    
    if (!erasing) {
      const newPath: Path = { points: [{ x: pos.x, y: pos.y }] }
      setCurrentPath(newPath)
      setDrawingHistory(prev => [...prev, newPath])
    }
    draw(e)
  }

  const draw = (e: MouseEvent | TouchEvent) => {
    if (!drawing || !isMouseDown) return
    const pos = getCanvasPos(e)

    if (erasing) {
      const radius = 15
      setDrawingHistory(prev => 
        prev.map(path => ({
          ...path,
          points: path.points.filter(p => {
            const dx = p.x - pos.x
            const dy = p.y - pos.y
            return dx * dx + dy * dy > radius * radius
          })
        })).filter(path => path.points.length > 0)
      )
      redrawCanvas()
    } else if (currentPath) {
      setCurrentPath(prev => prev ? { ...prev, points: [...prev.points, { x: pos.x, y: pos.y }] } : null)
      redrawCanvas()
    }
  }

  const stopDrawing = () => {
    setIsMouseDown(false)
    if (currentPath) {
      // Smooth curves only
      const smoothed = smoothPath(currentPath.points)
      
      setDrawingHistory(prev => 
        prev.map((path, index) => 
          index === prev.length - 1 ? { ...path, points: smoothed } : path
        )
      )
      setCurrentPath(null)
      redrawCanvas()
    }
  }

  // Update eraser cursor
  const updateEraserCursor = (x: number, y: number) => {
    if (eraserCursorRef.current) {
      eraserCursorRef.current.style.left = `${x - 20}px`
      eraserCursorRef.current.style.top = `${y - 20}px`
    }
  }

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const newSize = calculateCanvasSize()
      setCanvasSize(newSize)
    }

    window.addEventListener('resize', handleResize)
    handleResize() // Initial calculation

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Initialize players and canvas
  useEffect(() => {
    if (!canvasRef.current || !playersContainerRef.current) return

    // Set canvas size
    const canvas = canvasRef.current
    canvas.width = canvasSize.width
    canvas.height = canvasSize.height

    // Clear existing players
    if (playersContainerRef.current) {
      playersContainerRef.current.innerHTML = ''
    }

    // Create players
    players.current.center = createPlayer('center', 'C', 'center')!
    players.current.qb = createPlayer('qb', 'QB', 'qb')!
    players.current.wr1 = createPlayer('wr1', 'WR1', 'wr')!
    players.current.wr2 = createPlayer('wr2', 'WR2', 'wr')!
    players.current.wr3 = createPlayer('wr3', 'WR3', 'wr')!
    players.current.wr4 = createPlayer('wr4', 'WR4', 'wr')!

    // Set initial formation
    setFormation(selectedFormation)
    redrawCanvas()

    // Add event listeners
    const handleMouseMove = (e: MouseEvent) => {
      if (erasing) {
        const rect = canvas.getBoundingClientRect()
        updateEraserCursor(e.clientX - rect.left, e.clientY - rect.top)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (erasing) {
        const rect = canvas.getBoundingClientRect()
        const touch = e.touches[0]
        updateEraserCursor(touch.clientX - rect.left, touch.clientY - rect.top)
      }
    }

    // Add click outside handler for color palette
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPalette && !(e.target as Element).closest('.color-palette') && !(e.target as Element).closest('.player')) {
        hideColorPalette()
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('click', handleClickOutside)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [erasing, canvasSize, colorPalette])

  // Handle formation changes separately
  useEffect(() => {
    if (selectedFormation !== 'custom') {
      setFormation(selectedFormation)
    }
  }, [selectedFormation])

  // Redraw when drawing history changes
  useEffect(() => {
    redrawCanvas()
  }, [drawingHistory])

  // Update player colors when they change
  useEffect(() => {
    Object.entries(playerColors).forEach(([playerId, color]) => {
      const player = players.current[playerId]
      if (player) {
        player.style.backgroundColor = color
      }
    })
  }, [playerColors])

  return (
    <div>
      <div id="controls">
        <label>
          Formation:
          <select 
            value={selectedFormation} 
            onChange={(e) => {
              setSelectedFormation(e.target.value)
              if (e.target.value !== 'custom') {
                setFormation(e.target.value)
                setDrawingHistory([])
              }
            }}
          >
            <option value="gunEmptyBunch">Gun - Empty - Bunch</option>
            <option value="gunEmptyAce">Gun - Empty - Ace</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        
        <button 
          onClick={() => {
            setDrawing(true)
            setErasing(false)
            if (eraserCursorRef.current) {
              eraserCursorRef.current.style.display = 'none'
            }
          }}
        >
          Draw
        </button>
        
        <button 
          onClick={() => {
            setDrawing(true)
            setErasing(true)
            if (eraserCursorRef.current) {
              eraserCursorRef.current.style.display = 'block'
            }
          }}
        >
          Eraser
        </button>
        
        <button 
          onClick={() => {
            if (drawingHistory.length > 0) {
              setDrawingHistory(prev => prev.slice(0, -1))
            }
          }}
        >
          Undo Marker
        </button>
        
        <button 
          onClick={() => {
            setDrawingHistory([])
          }}
        >
          Clear
        </button>
        
        <button 
          onClick={flipFormation}
        >
          Flip Formation
        </button>
      </div>

      <div className="field-container">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
          style={{ 
            touchAction: 'none',
            maxWidth: '100%',
            height: 'auto'
          }}
        />
        <div ref={playersContainerRef} />
        <div ref={eraserCursorRef} id="eraserCursor" />
        
        {/* Color Palette */}
        {colorPalette && (
          <div 
            className="color-palette"
            style={{
              position: 'absolute',
              left: `${colorPalette.x}px`,
              top: `${colorPalette.y}px`,
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              padding: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              borderRadius: '8px',
              border: '2px solid white',
              zIndex: 1000
            }}
          >
            {colors.map((color) => (
              <button
                key={color.name}
                onClick={() => changePlayerColor(colorPalette.playerId, color.value)}
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: color.value,
                  border: '2px solid white',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                title={color.name}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
