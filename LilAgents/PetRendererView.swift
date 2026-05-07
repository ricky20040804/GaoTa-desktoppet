import AppKit

final class PetRendererView: NSView {
    private let package: PetPackage
    private let animator: PetAnimator
    private var currentTime: CFTimeInterval
    private var dragStartScreenPoint: CGPoint?
    private var dragStartWindowOrigin: CGPoint?
    private var isDraggingWindow = false
    var isHorizontallyFlipped = false {
        didSet {
            if oldValue != isHorizontallyFlipped {
                needsDisplay = true
            }
        }
    }
    var onClick: (() -> Void)?
    var isDragging: Bool {
        isDraggingWindow || dragStartScreenPoint != nil
    }
    var currentMotionName: String {
        animator.currentMotionName
    }

    override var isFlipped: Bool { true }

    init(frame: CGRect, package: PetPackage) {
        self.package = package
        self.animator = PetAnimator(motion: package.motion)
        self.currentTime = CACurrentMediaTime()
        super.init(frame: frame)
        wantsLayer = true
        layer?.backgroundColor = NSColor.clear.cgColor
    }

    required init?(coder: NSCoder) {
        nil
    }

    func advance(to time: CFTimeInterval) {
        guard !isDraggingWindow, dragStartScreenPoint == nil else { return }

        currentTime = time
        needsDisplay = true
    }

    func playMotion(_ motionName: String, at time: CFTimeInterval) {
        animator.play(motionName, at: time)
        currentTime = time
        needsDisplay = true
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard let context = NSGraphicsContext.current?.cgContext else { return }

        let canvas = package.template.canvas
        let viewScale = min(bounds.width / canvas.width, bounds.height / canvas.height)

        context.saveGState()
        if isHorizontallyFlipped {
            context.translateBy(x: bounds.width, y: 0)
            context.scaleBy(x: -1, y: 1)
        }

        for entry in package.template.parts.sorted(by: { $0.value.zIndex < $1.value.zIndex }) {
            let part = entry.value
            guard let image = package.images[part.image] else { continue }

            let partScale = part.scale ?? 1
            let rect = CGRect(
                x: part.position.x * viewScale,
                y: part.position.y * viewScale,
                width: part.size.width * partScale * viewScale,
                height: part.size.height * partScale * viewScale
            )
            let pivot = CGPoint(
                x: rect.minX + part.pivot.x * partScale * viewScale,
                y: rect.minY + part.pivot.y * partScale * viewScale
            )
            let templateRotation = part.rotation ?? 0
            let motionRotation = animator.rotation(for: part.bone, at: currentTime)
            let totalRotation = templateRotation + motionRotation

            context.saveGState()
            context.translateBy(x: pivot.x, y: pivot.y)
            context.rotate(by: totalRotation * .pi / 180)
            context.translateBy(x: -pivot.x, y: -pivot.y)
            image.draw(in: rect, from: .zero, operation: .sourceOver, fraction: 1, respectFlipped: true, hints: nil)
            context.restoreGState()
        }

        context.restoreGState()
    }

    override func mouseDown(with event: NSEvent) {
        dragStartScreenPoint = NSEvent.mouseLocation
        dragStartWindowOrigin = window?.frame.origin
        isDraggingWindow = false
    }

    override func mouseDragged(with event: NSEvent) {
        guard let window,
              let dragStartScreenPoint,
              let dragStartWindowOrigin else { return }

        let current = NSEvent.mouseLocation
        let delta = CGPoint(x: current.x - dragStartScreenPoint.x, y: current.y - dragStartScreenPoint.y)
        if hypot(delta.x, delta.y) < 5 {
            return
        }

        isDraggingWindow = true
        let targetOrigin = CGPoint(x: dragStartWindowOrigin.x + delta.x, y: dragStartWindowOrigin.y + delta.y)
        window.setFrame(CGRect(origin: targetOrigin, size: window.frame.size), display: false, animate: false)
    }

    override func mouseUp(with event: NSEvent) {
        if !isDraggingWindow {
            onClick?()
        } else {
            needsDisplay = true
        }
        dragStartScreenPoint = nil
        dragStartWindowOrigin = nil
        isDraggingWindow = false
    }
}
