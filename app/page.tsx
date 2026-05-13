'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Thought = {
  id: number
  text: string
  x: number
  y: number
  vx: number
  vy: number
  user_id: string | null
}

type SupabaseThoughtRow = {
  id: number
  text: string
  x: number
  y: number
  user_id: string | null
}

export default function Home() {
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [input, setInput] = useState('')

  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  const dragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  // 📥 LOAD (immer frische DB Daten)
  async function loadThoughts() {
    const { data, error } = await supabase
      .from('thoughts')
      .select('id, text, x, y, user_id')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error.message)
      return
    }

    if (data) {
      const enriched: Thought[] = (data as SupabaseThoughtRow[]).map((t) => ({
        ...t,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
      }))

      setThoughts(enriched)
    }
  }

  // ➕ ADD
  async function addThought() {
    if (!input.trim()) return

    const { error } = await supabase.from('thoughts').insert({
      text: input,
      x: Math.random() * 2000 - 1000,
      y: Math.random() * 2000 - 1000,
      user_id: null,
    })

    if (error) {
      console.error(error.message)
      return
    }

    setInput('')

    // 🔥 wichtig: danach neu aus DB laden
    loadThoughts()
  }

  // 🗑️ DELETE (FIXED → wirklich aus DB entfernen)
  async function deleteThought(id: number) {
    const { error } = await supabase
      .from('thoughts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error(error.message)
      return
    }

    // sofort lokal entfernen (kein „wieder auftauchen“ Gefühl)
    setThoughts((prev) => prev.filter((t) => t.id !== id))
  }

  useEffect(() => {
    loadThoughts()
  }, [])

  // 🌊 ANIMATION LOOP (smooth movement)
  useEffect(() => {
    let frame: number

    const animate = () => {
      setThoughts((prev) => {
        const updated = prev.map((t) => ({
          ...t,
          x: t.x + t.vx,
          y: t.y + t.vy,
        }))

        // 🧲 Anti-overlap
        for (let i = 0; i < updated.length; i++) {
          for (let j = i + 1; j < updated.length; j++) {
            const a = updated[i]
            const b = updated[j]

            const dx = a.x - b.x
            const dy = a.y - b.y
            const dist = Math.sqrt(dx * dx + dy * dy)

            const minDist = 140

            if (dist > 0 && dist < minDist) {
              const force = (minDist - dist) * 0.0015

              const fx = (dx / dist) * force
              const fy = (dy / dist) * force

              a.x += fx
              a.y += fy
              b.x -= fx
              b.y -= fy
            }
          }
        }

        return updated
      })

      frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  // 🖱️ DRAG
  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }

  function onMouseUp() {
    dragging.current = false
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return

    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y

    setOffset((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }))

    lastMouse.current = { x: e.clientX, y: e.clientY }
  }

  // 🔍 ZOOM
  function onWheel(e: React.WheelEvent) {
    e.preventDefault()

    const zoomSpeed = 0.001
    const newZoom = zoom - e.deltaY * zoomSpeed

    setZoom(Math.min(Math.max(newZoom, 0.3), 3))
  }

  return (
    <main
      className="w-screen h-screen bg-black overflow-hidden relative cursor-grab active:cursor-grabbing"
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
      onWheel={onWheel}
    >
      {/* WORLD */}
      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: 'center',
        }}
        className="w-full h-full absolute"
      >
        {thoughts.map((t) => (
          <div
            key={t.id}
            className="absolute bg-white/90 text-black px-3 py-2 rounded-lg shadow-md select-none text-sm w-32 text-center"
            style={{
              left: `${t.x}px`,
              top: `${t.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {t.text}

            <button
              onClick={() => deleteThought(t.id)}
              className="block mt-2 text-xs text-red-600 hover:text-red-800"
            >
              löschen
            </button>
          </div>
        ))}
      </div>

      {/* INPUT */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 bg-black/60 p-3 rounded-xl backdrop-blur-md">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addThought()}
          placeholder="Schreib deinen Gedanken..."
          className="px-4 py-2 rounded bg-white text-black w-64"
        />

        <button
          onClick={addThought}
          className="bg-white px-4 py-2 rounded hover:bg-gray-200"
        >
          Senden
        </button>
      </div>
    </main>
  )
}