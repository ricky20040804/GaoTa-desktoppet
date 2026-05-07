import SwiftUI
import AppKit
import Sparkle

@main
struct LilAgentsApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        Settings { EmptyView() }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    var controller: LilAgentsController?
    var statusItem: NSStatusItem?
    let updaterController = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: nil, userDriverDelegate: nil)

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        controller = LilAgentsController()
        controller?.start()
        setupMenuBar()
    }

    func applicationWillTerminate(_ notification: Notification) {
        controller?.customPet?.terminateSession()
    }

    private func setupMenuBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        if let button = statusItem?.button {
            button.image = NSImage(named: "MenuBarIcon") ?? NSImage(systemSymbolName: "pawprint", accessibilityDescription: "custom pet")
            button.imagePosition = .imageOnly
            button.toolTip = "高塔桌面宠物——火柴"
        }

        let menu = NSMenu()

        let resetPositionItem = NSMenuItem(title: "回到桌面底部", action: #selector(resetCharacterPosition), keyEquivalent: "")
        menu.addItem(resetPositionItem)

        let doubaoSettingsItem = NSMenuItem(title: "豆包 API 设置…", action: #selector(openDoubaoSettings), keyEquivalent: "")
        menu.addItem(doubaoSettingsItem)

        let themeItem = NSMenuItem(title: "样式", action: nil, keyEquivalent: "")
        let themeMenu = NSMenu()
        for (index, theme) in PopoverTheme.allThemes.enumerated() {
            let item = NSMenuItem(title: theme.name, action: #selector(switchTheme(_:)), keyEquivalent: "")
            item.tag = index
            item.state = theme.name == PopoverTheme.current.name ? .on : .off
            themeMenu.addItem(item)
        }
        themeItem.submenu = themeMenu
        menu.addItem(themeItem)

        menu.addItem(NSMenuItem.separator())

        let updateItem = NSMenuItem(title: "检查更新…", action: #selector(SPUStandardUpdaterController.checkForUpdates(_:)), keyEquivalent: "")
        updateItem.target = updaterController
        menu.addItem(updateItem)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "退出", action: #selector(quitApp), keyEquivalent: "q")
        menu.addItem(quitItem)

        statusItem?.menu = menu
    }

    @objc private func switchTheme(_ sender: NSMenuItem) {
        let index = sender.tag
        guard index < PopoverTheme.allThemes.count else { return }
        PopoverTheme.current = PopoverTheme.allThemes[index]

        if let themeMenu = sender.menu {
            for item in themeMenu.items {
                item.state = item.tag == index ? .on : .off
            }
        }

        controller?.customPet?.themeDidChange()
    }

    @objc private func resetCharacterPosition() {
        controller?.customPet?.resetToDefaultPosition()
    }

    @objc private func openDoubaoSettings() {
        DoubaoSession.showSettingsPanel { [weak self] in
            self?.controller?.customPet?.resetSession()
        }
    }

    @objc private func quitApp() {
        NSApp.terminate(nil)
    }
}
