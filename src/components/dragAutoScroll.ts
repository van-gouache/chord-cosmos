import { useEffect } from 'react'

/** How close to an edge before that pane starts moving. */
const EDGE = 64
/** Fastest scroll, when the pointer is on the lip of the pane. */
const MAX_SPEED = 22

function canScroll(el: HTMLElement): { x: boolean; y: boolean } {
  const style = getComputedStyle(el)
  const y =
    /(auto|scroll)/.test(style.overflowY) &&
    el.scrollHeight > el.clientHeight + 1
  const x =
    /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1
  return { x, y }
}

function scrollablesFrom(start: Element | null): HTMLElement[] {
  const found: HTMLElement[] = []
  let node: Element | null = start
  while (node) {
    if (node instanceof HTMLElement) {
      const { x, y } = canScroll(node)
      if (x || y) found.push(node)
    }
    node = node.parentElement
  }
  return found
}

function edgeDelta(position: number, start: number, end: number): number {
  if (end - start <= EDGE * 2) return 0
  if (position < start + EDGE) {
    return -Math.ceil(MAX_SPEED * (1 - Math.max(0, position - start) / EDGE))
  }
  if (position > end - EDGE) {
    return Math.ceil(MAX_SPEED * (1 - Math.max(0, end - position) / EDGE))
  }
  return 0
}

function scrollNearEdges(x: number, y: number): void {
  const under = document.elementFromPoint(x, y)
  for (const box of scrollablesFrom(under)) {
    const { x: canX, y: canY } = canScroll(box)
    const rect = box.getBoundingClientRect()
    if (canY) {
      const dy = edgeDelta(y, rect.top, rect.bottom)
      if (dy) box.scrollTop += dy
    }
    if (canX) {
      const dx = edgeDelta(x, rect.left, rect.right)
      if (dx) box.scrollLeft += dx
    }
  }
}

/**
 * Native drag-and-drop swallows scrolling. While a drag is live, move any
 * scrollable pane the pointer is over when it hugs an edge, and honor the
 * wheel so a trackpad can still pan.
 */
export function useDragAutoScroll(): void {
  useEffect(() => {
    let dragging = false
    let x = 0
    let y = 0
    let frame = 0

    const halt = () => {
      dragging = false
      if (frame) cancelAnimationFrame(frame)
      frame = 0
    }

    const tick = () => {
      frame = 0
      if (!dragging) return
      scrollNearEdges(x, y)
      frame = requestAnimationFrame(tick)
    }

    const onStart = () => {
      dragging = true
      if (!frame) frame = requestAnimationFrame(tick)
    }

    const onOver = (event: DragEvent) => {
      x = event.clientX
      y = event.clientY
      if (dragging && !frame) frame = requestAnimationFrame(tick)
    }

    const onWheel = (event: WheelEvent) => {
      if (!dragging) return
      const boxes = scrollablesFrom(document.elementFromPoint(event.clientX, event.clientY))
      if (boxes.length === 0) return
      event.preventDefault()
      const box = boxes[0]
      box.scrollTop += event.deltaY
      box.scrollLeft += event.deltaX
    }

    document.addEventListener('dragstart', onStart, true)
    document.addEventListener('dragover', onOver, true)
    document.addEventListener('dragend', halt, true)
    document.addEventListener('drop', halt, true)
    document.addEventListener('wheel', onWheel, { capture: true, passive: false })

    return () => {
      halt()
      document.removeEventListener('dragstart', onStart, true)
      document.removeEventListener('dragover', onOver, true)
      document.removeEventListener('dragend', halt, true)
      document.removeEventListener('drop', halt, true)
      document.removeEventListener('wheel', onWheel, true)
    }
  }, [])
}
