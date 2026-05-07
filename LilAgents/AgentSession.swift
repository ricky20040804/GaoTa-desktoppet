import Foundation

enum AgentProvider: String, CaseIterable {
    case doubao

    private static let defaultsKey = "selectedProvider"

    static var current: AgentProvider {
        get {
            let raw = UserDefaults.standard.string(forKey: defaultsKey) ?? AgentProvider.doubao.rawValue
            return AgentProvider(rawValue: raw) ?? .doubao
        }
        set {
            UserDefaults.standard.set(newValue.rawValue, forKey: defaultsKey)
        }
    }

    var displayName: String {
        "火柴"
    }

    var inputPlaceholder: String {
        "和火柴聊点什么..."
    }

    func titleString(format: TitleFormat) -> String {
        switch format {
        case .uppercase:
            return "火柴桌面宠物"
        case .lowercaseTilde:
            return "火柴桌面宠物"
        case .capitalized:
            return "火柴桌面宠物"
        }
    }

    var isAvailable: Bool {
        DoubaoConfig.load().isConfigured
    }

    func createSession() -> any AgentSession {
        DoubaoSession()
    }
}

enum TitleFormat {
    case uppercase
    case lowercaseTilde
    case capitalized
}

struct AgentMessage {
    enum Role {
        case user
        case assistant
        case error
        case toolUse
        case toolResult
    }

    let role: Role
    let text: String
}

protocol AgentSession: AnyObject {
    var isRunning: Bool { get }
    var isBusy: Bool { get }
    var history: [AgentMessage] { get set }

    var onText: ((String) -> Void)? { get set }
    var onError: ((String) -> Void)? { get set }
    var onToolUse: ((String, [String: Any]) -> Void)? { get set }
    var onToolResult: ((String, Bool) -> Void)? { get set }
    var onSessionReady: (() -> Void)? { get set }
    var onTurnComplete: (() -> Void)? { get set }
    var onProcessExit: (() -> Void)? { get set }

    func start()
    func send(message: String)
    func terminate()
}
