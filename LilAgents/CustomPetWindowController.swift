import AppKit

final class KeyableWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

final class CustomPetWindowController {
    private let package: PetPackage
    private let rendererView: PetRendererView
    let window: NSWindow
    private let provider: AgentProvider = .doubao
    private var popoverWindow: NSWindow?
    private var terminalView: TerminalView?
    private var session: (any AgentSession)?
    private var clickOutsideMonitor: Any?
    private var escapeKeyMonitor: Any?
    private var currentStreamingText = ""
    private static let bottomOffset: CGFloat = 12
    private static let bottomActivationThreshold: CGFloat = 28
    private static let edgeTurnPadding: CGFloat = 28
    private static let walkSpeed: CGFloat = 90
    private static let idleDurationRange: ClosedRange<CFTimeInterval> = 1.2...3.0
    private static let walkDurationRange: ClosedRange<CFTimeInterval> = 2.0...5.0
    private var walkDirection: CGFloat = -1
    private var walkSegmentStartX: CGFloat?
    private var walkSegmentStartTime: CFTimeInterval?
    private var currentActionEndTime: CFTimeInterval?
    private var isInteractionOpen = false

    init(package: PetPackage) {
        self.package = package

        let screen = NSScreen.main ?? NSScreen.screens.first
        let canvas = package.template.canvas
        let displayHeight: CGFloat = 200
        let displayWidth = displayHeight * canvas.width / canvas.height
        let screenFrame = screen?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1440, height: 900)
        let origin = CGPoint(
            x: screenFrame.midX - displayWidth / 2,
            y: screenFrame.minY + Self.bottomOffset
        )

        let contentRect = CGRect(origin: origin, size: CGSize(width: displayWidth, height: displayHeight))
        self.window = NSWindow(contentRect: contentRect, styleMask: .borderless, backing: .buffered, defer: false)
        self.rendererView = PetRendererView(frame: CGRect(origin: .zero, size: contentRect.size), package: package)

        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = false
        window.level = .statusBar
        window.ignoresMouseEvents = false
        window.collectionBehavior = [.moveToActiveSpace, .stationary]
        rendererView.onClick = { [weak self] in
            self?.togglePopover()
        }
        window.contentView = rendererView
    }

    static func makeDefault() -> CustomPetWindowController? {
        do {
            let package = try PetPackageLoader.loadDefaultPackage()
            print("Loaded custom_pet package at \(package.rootURL.path)")
            return CustomPetWindowController(package: package)
        } catch {
            print("Failed to load custom_pet package: \(error)")
            return nil
        }
    }

    func show() {
        window.orderFrontRegardless()
    }

    func update(now: CFTimeInterval) {
        updateRandomMotion(now: now)
        rendererView.advance(to: now)
        updateWalkMovement(now: now)
        updatePopoverPosition()
    }

    func resetToDefaultPosition() {
        guard let screen = NSScreen.main ?? NSScreen.screens.first else { return }
        let frame = window.frame
        window.setFrameOrigin(CGPoint(
            x: screen.visibleFrame.midX - frame.width / 2,
            y: screen.visibleFrame.minY + Self.bottomOffset
        ))
        resetWalkCycle(now: nil)
        updatePopoverPosition()
    }

    private func updateRandomMotion(now: CFTimeInterval) {
        guard !isInteractionOpen else {
            if rendererView.currentMotionName != "idle" {
                rendererView.playMotion("idle", at: now)
            }
            stopWalkMovement()
            currentActionEndTime = nil
            return
        }

        if currentActionEndTime == nil || now >= (currentActionEndTime ?? now) {
            let nextMotion = Bool.random() ? "walk" : "idle"
            rendererView.playMotion(nextMotion, at: now)

            if nextMotion == "walk" {
                startRandomWalkSegment(now: now)
                currentActionEndTime = now + CFTimeInterval.random(in: Self.walkDurationRange)
            } else {
                stopWalkMovement()
                currentActionEndTime = now + CFTimeInterval.random(in: Self.idleDurationRange)
            }
        }
    }

    private func updateWalkMovement(now: CFTimeInterval) {
        guard rendererView.currentMotionName == "walk",
              !rendererView.isDragging,
              isWindowOnDesktopBottom else {
            stopWalkMovement()
            return
        }

        if walkSegmentStartTime == nil {
            startRandomWalkSegment(now: now)
        }

        var frame = window.frame
        let screenFrame = activeScreenVisibleFrame
        let elapsed = max(0, now - (walkSegmentStartTime ?? now))
        let startX = walkSegmentStartX ?? frame.origin.x
        frame.origin.x = startX + walkDirection * Self.walkSpeed * CGFloat(elapsed)
        frame.origin.y = screenFrame.minY + Self.bottomOffset

        if frame.minX <= screenFrame.minX + Self.edgeTurnPadding {
            frame.origin.x = screenFrame.minX + Self.edgeTurnPadding
            startRandomWalkSegment(now: now, fromX: frame.origin.x, forcedDirection: 1)
        } else if frame.maxX >= screenFrame.maxX - Self.edgeTurnPadding {
            frame.origin.x = screenFrame.maxX - frame.width - Self.edgeTurnPadding
            startRandomWalkSegment(now: now, fromX: frame.origin.x, forcedDirection: -1)
        }

        window.setFrame(frame, display: false, animate: false)
    }

    private var isWindowOnDesktopBottom: Bool {
        abs(window.frame.minY - (activeScreenVisibleFrame.minY + Self.bottomOffset)) <= Self.bottomActivationThreshold
    }

    private var activeScreenVisibleFrame: CGRect {
        if let screen = window.screen {
            return screen.visibleFrame
        }

        let windowFrame = window.frame
        return NSScreen.screens.first { $0.frame.intersects(windowFrame) }?.visibleFrame
            ?? NSScreen.main?.visibleFrame
            ?? CGRect(x: 0, y: 0, width: 1440, height: 900)
    }

    private func resetWalkCycle(now: CFTimeInterval?) {
        currentActionEndTime = nil
        if let now {
            rendererView.playMotion("walk", at: now)
            startRandomWalkSegment(now: now)
        } else {
            stopWalkMovement()
        }
    }

    private func startRandomWalkSegment(
        now: CFTimeInterval,
        fromX: CGFloat? = nil,
        forcedDirection: CGFloat? = nil
    ) {
        walkDirection = forcedDirection ?? (Bool.random() ? 1 : -1)
        walkSegmentStartTime = now
        walkSegmentStartX = fromX ?? window.frame.origin.x
        rendererView.isHorizontallyFlipped = walkDirection > 0
    }

    private func stopWalkMovement() {
        walkSegmentStartTime = nil
        walkSegmentStartX = nil
    }

    func terminateSession() {
        removeEventMonitors()
        session?.terminate()
    }

    func resetSession() {
        session?.terminate()
        session = nil
        currentStreamingText = ""
        terminalView?.resetState()
        terminalView?.showSessionMessage()
        ensureSession()
    }

    func themeDidChange() {
        let wasVisible = popoverWindow?.isVisible ?? false
        popoverWindow?.orderOut(nil)
        popoverWindow = nil
        terminalView = nil

        if wasVisible {
            openPopover()
            if let session, !session.history.isEmpty {
                terminalView?.replayHistory(session.history)
            }
        }
    }

    private func togglePopover() {
        if popoverWindow?.isVisible == true {
            closePopover()
        } else {
            openPopover()
        }
    }

    private func openPopover() {
        enterInteractionIdle()
        ensureSession()

        if popoverWindow == nil {
            createPopoverWindow()
        }

        if let terminalView, let session, !session.history.isEmpty {
            terminalView.replayHistory(session.history)
        }

        updatePopoverPosition()
        popoverWindow?.orderFrontRegardless()
        popoverWindow?.makeKey()

        if let terminalView {
            popoverWindow?.makeFirstResponder(terminalView.inputField)
        }

        removeEventMonitors()

        clickOutsideMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { [weak self] _ in
            guard let self, let popoverWindow = self.popoverWindow else { return }
            let mouse = NSEvent.mouseLocation
            if !popoverWindow.frame.contains(mouse) && !self.window.frame.contains(mouse) {
                self.closePopover()
            }
        }

        escapeKeyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if event.keyCode == 53 {
                self?.closePopover()
                return nil
            }
            return event
        }
    }

    private func closePopover() {
        isInteractionOpen = false
        currentActionEndTime = nil
        popoverWindow?.orderOut(nil)
        removeEventMonitors()
    }

    private func enterInteractionIdle() {
        isInteractionOpen = true
        stopWalkMovement()
        currentActionEndTime = nil
        rendererView.playMotion("idle", at: CACurrentMediaTime())
    }

    private func ensureSession() {
        guard session == nil else { return }

        let newSession = provider.createSession()
        session = newSession
        wireSession(newSession)
        newSession.start()
    }

    private func wireSession(_ session: any AgentSession) {
        session.onText = { [weak self] text in
            self?.currentStreamingText += text
            self?.terminalView?.appendStreamingText(text)
        }

        session.onTurnComplete = { [weak self] in
            self?.terminalView?.endStreaming()
        }

        session.onError = { [weak self] text in
            self?.terminalView?.appendError(text)
        }

        session.onToolUse = { [weak self] toolName, input in
            let summary = self?.formatToolInput(input) ?? ""
            self?.terminalView?.appendToolUse(toolName: toolName, summary: summary)
        }

        session.onToolResult = { [weak self] summary, isError in
            self?.terminalView?.appendToolResult(summary: summary, isError: isError)
        }

        session.onProcessExit = { [weak self] in
            self?.terminalView?.endStreaming()
            self?.terminalView?.appendError("火柴会话已结束。")
        }

        session.onSessionReady = { }
    }

    private func createPopoverWindow() {
        let theme = PopoverTheme.current
        let popoverWidth: CGFloat = 456
        let popoverHeight: CGFloat = 382
        let titleBarHeight: CGFloat = 32
        let selectorHeight: CGFloat = 50

        let popover = KeyableWindow(
            contentRect: CGRect(x: 0, y: 0, width: popoverWidth, height: popoverHeight),
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )
        popover.isOpaque = false
        popover.backgroundColor = .clear
        popover.hasShadow = true
        popover.level = NSWindow.Level(rawValue: NSWindow.Level.statusBar.rawValue + 10)
        popover.collectionBehavior = [.moveToActiveSpace, .stationary]
        let brightness = theme.popoverBg.redComponent * 0.299 + theme.popoverBg.greenComponent * 0.587 + theme.popoverBg.blueComponent * 0.114
        popover.appearance = NSAppearance(named: brightness < 0.5 ? .darkAqua : .aqua)

        let container = NSView(frame: NSRect(x: 0, y: 0, width: popoverWidth, height: popoverHeight))
        container.wantsLayer = true
        container.layer?.backgroundColor = theme.popoverBg.cgColor
        container.layer?.cornerRadius = theme.popoverCornerRadius
        container.layer?.masksToBounds = true
        container.layer?.borderWidth = theme.popoverBorderWidth
        container.layer?.borderColor = theme.popoverBorder.cgColor
        container.autoresizingMask = [.width, .height]

        let titleBar = NSView(frame: NSRect(x: 0, y: popoverHeight - titleBarHeight, width: popoverWidth, height: titleBarHeight))
        titleBar.wantsLayer = true
        titleBar.layer?.backgroundColor = theme.titleBarBg.cgColor
        container.addSubview(titleBar)

        let titleLabel = NSTextField(labelWithString: theme.titleString(for: provider))
        titleLabel.font = theme.titleFont
        titleLabel.textColor = theme.titleText
        titleLabel.sizeToFit()
        titleLabel.frame.origin = NSPoint(x: 14, y: 8)
        titleBar.addSubview(titleLabel)

        let refreshButton = NSButton(frame: NSRect(x: popoverWidth - 54, y: 8, width: 16, height: 16))
        refreshButton.image = NSImage(systemSymbolName: "arrow.clockwise", accessibilityDescription: "Refresh")
        refreshButton.imageScaling = .scaleProportionallyDown
        refreshButton.bezelStyle = .inline
        refreshButton.isBordered = false
        refreshButton.contentTintColor = theme.titleText.withAlphaComponent(0.75)
        refreshButton.target = self
        refreshButton.action = #selector(refreshSessionFromButton)
        titleBar.addSubview(refreshButton)

        let copyButton = NSButton(frame: NSRect(x: popoverWidth - 30, y: 8, width: 16, height: 16))
        copyButton.image = NSImage(systemSymbolName: "square.on.square", accessibilityDescription: "Copy")
        copyButton.imageScaling = .scaleProportionallyDown
        copyButton.bezelStyle = .inline
        copyButton.isBordered = false
        copyButton.contentTintColor = theme.titleText.withAlphaComponent(0.75)
        copyButton.target = self
        copyButton.action = #selector(copyLastResponseFromButton)
        titleBar.addSubview(copyButton)

        let titleSep = NSView(frame: NSRect(x: 0, y: popoverHeight - titleBarHeight - 1, width: popoverWidth, height: 1))
        titleSep.wantsLayer = true
        titleSep.layer?.backgroundColor = theme.separatorColor.cgColor
        container.addSubview(titleSep)

        let selectorBar = NSView(frame: NSRect(x: 0, y: popoverHeight - titleBarHeight - selectorHeight, width: popoverWidth, height: selectorHeight))
        selectorBar.wantsLayer = true
        selectorBar.layer?.backgroundColor = theme.popoverBg.blended(withFraction: 0.08, of: theme.titleBarBg)?.cgColor ?? theme.popoverBg.cgColor
        selectorBar.autoresizingMask = [.width, .minYMargin]
        container.addSubview(selectorBar)

        let selectorSep = NSView(frame: NSRect(x: 0, y: selectorBar.frame.minY - 1, width: popoverWidth, height: 1))
        selectorSep.wantsLayer = true
        selectorSep.layer?.backgroundColor = theme.separatorColor.cgColor
        container.addSubview(selectorSep)

        let terminal = TerminalView(
            frame: NSRect(
                x: 0,
                y: 0,
                width: popoverWidth,
                height: popoverHeight - titleBarHeight - selectorHeight - 2
            )
        )
        terminal.characterColor = theme.accentColor
        terminal.provider = provider
        terminal.autoresizingMask = [.width, .height]
        terminal.onSendMessage = { [weak self] message in
            self?.session?.send(message: message)
        }
        terminal.onClearRequested = { [weak self] in
            self?.resetSession()
        }
        container.addSubview(terminal)

        popover.contentView = container
        popoverWindow = popover
        terminalView = terminal
    }

    private func updatePopoverPosition() {
        guard let popoverWindow, popoverWindow.isVisible else { return }
        let petFrame = window.frame
        let popoverSize = popoverWindow.frame.size
        let screenFrame = window.screen?.frame ?? NSScreen.main?.frame ?? CGRect(x: 0, y: 0, width: 1440, height: 900)

        var x = petFrame.midX - popoverSize.width / 2
        let y = petFrame.maxY - 15
        x = max(screenFrame.minX + 4, min(x, screenFrame.maxX - popoverSize.width - 4))
        let clampedY = min(y, screenFrame.maxY - popoverSize.height - 4)

        popoverWindow.setFrameOrigin(NSPoint(x: x, y: clampedY))
    }

    private func removeEventMonitors() {
        if let clickOutsideMonitor {
            NSEvent.removeMonitor(clickOutsideMonitor)
            self.clickOutsideMonitor = nil
        }
        if let escapeKeyMonitor {
            NSEvent.removeMonitor(escapeKeyMonitor)
            self.escapeKeyMonitor = nil
        }
    }

    private func formatToolInput(_ input: [String: Any]) -> String {
        if let command = input["command"] as? String { return command }
        if let path = input["file_path"] as? String { return path }
        if let pattern = input["pattern"] as? String { return pattern }
        return input.keys.sorted().prefix(3).joined(separator: ", ")
    }

    @objc private func copyLastResponseFromButton() {
        terminalView?.handleSlashCommandPublic("/copy")
    }

    @objc private func refreshSessionFromButton() {
        resetSession()
    }
}
