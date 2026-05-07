import AppKit

final class LilAgentsController {
    var customPet: CustomPetWindowController?
    private var displayLink: CVDisplayLink?

    func start() {
        guard let customPet = CustomPetWindowController.makeDefault() else {
            return
        }

        self.customPet = customPet
        customPet.show()
        startDisplayLink()
    }

    private func startDisplayLink() {
        CVDisplayLinkCreateWithActiveCGDisplays(&displayLink)
        guard let displayLink else { return }

        let callback: CVDisplayLinkOutputCallback = { _, _, _, _, _, userInfo -> CVReturn in
            let controller = Unmanaged<LilAgentsController>.fromOpaque(userInfo!).takeUnretainedValue()
            DispatchQueue.main.async {
                controller.tick()
            }
            return kCVReturnSuccess
        }

        CVDisplayLinkSetOutputCallback(displayLink, callback, Unmanaged.passUnretained(self).toOpaque())
        CVDisplayLinkStart(displayLink)
    }

    func tick() {
        customPet?.update(now: CACurrentMediaTime())
    }

    deinit {
        if let displayLink {
            CVDisplayLinkStop(displayLink)
        }
    }
}
