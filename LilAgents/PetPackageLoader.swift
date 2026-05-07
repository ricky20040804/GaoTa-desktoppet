import AppKit

struct PetPackage {
    let rootURL: URL
    let template: PetTemplate
    let motion: PetMotion
    let images: [String: NSImage]
}

enum PetPackageLoader {
    enum LoadError: Error {
        case missingDefaultPackage
        case missingImage(String)
    }

    static func defaultTemplateURL() -> URL? {
        let desktopTemplate = defaultDesktopRoot()
            .appendingPathComponent("PetTemplates")
            .appendingPathComponent("dog")
            .appendingPathComponent("beagle")
            .appendingPathComponent("template.json")
        if FileManager.default.fileExists(atPath: desktopTemplate.path) {
            return desktopTemplate
        }

        let bundleTemplate = Bundle.main.resourceURL?
            .appendingPathComponent("PetTemplates")
            .appendingPathComponent("dog")
            .appendingPathComponent("beagle")
            .appendingPathComponent("template.json")
        if let bundleTemplate, FileManager.default.fileExists(atPath: bundleTemplate.path) {
            return bundleTemplate
        }

        return nil
    }

    static func defaultMotionURL() -> URL? {
        let desktopMotion = defaultDesktopRoot()
            .appendingPathComponent("PetTemplates")
            .appendingPathComponent("dog")
            .appendingPathComponent("shared_motion.json")
        if FileManager.default.fileExists(atPath: desktopMotion.path) {
            return desktopMotion
        }

        let bundleMotion = Bundle.main.resourceURL?
            .appendingPathComponent("PetTemplates")
            .appendingPathComponent("dog")
            .appendingPathComponent("shared_motion.json")
        if let bundleMotion, FileManager.default.fileExists(atPath: bundleMotion.path) {
            return bundleMotion
        }

        return nil
    }

    private static func defaultDesktopRoot() -> URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Desktop")
            .appendingPathComponent("custom_pet")
    }

    static func loadDefaultPackage() throws -> PetPackage {
        guard let templateURL = defaultTemplateURL(),
              let motionURL = defaultMotionURL() else {
            throw LoadError.missingDefaultPackage
        }

        return try loadPackage(
            templateURL: templateURL,
            motionURL: motionURL,
            assetsRootURL: templateURL.deletingLastPathComponent()
        )
    }

    static func loadPackage(at rootURL: URL) throws -> PetPackage {
        try loadPackage(
            templateURL: rootURL.appendingPathComponent("template.json"),
            motionURL: rootURL.appendingPathComponent("motion.json"),
            assetsRootURL: rootURL
        )
    }

    static func loadPackage(templateURL: URL, motionURL: URL, assetsRootURL: URL) throws -> PetPackage {
        let decoder = JSONDecoder()
        let templateData = try Data(contentsOf: templateURL)
        let motionData = try Data(contentsOf: motionURL)
        let template = try decoder.decode(PetTemplate.self, from: templateData)
        let motion = try decoder.decode(PetMotion.self, from: motionData)

        var images: [String: NSImage] = [:]
        for part in template.parts.values {
            guard images[part.image] == nil else { continue }

            let imageURL = try resolveImageURL(part.image, in: assetsRootURL)
            guard let image = NSImage(contentsOf: imageURL) else {
                throw LoadError.missingImage(part.image)
            }
            images[part.image] = image
        }

        return PetPackage(rootURL: assetsRootURL, template: template, motion: motion, images: images)
    }

    private static func resolveImageURL(_ imagePath: String, in rootURL: URL) throws -> URL {
        let requestedURL = rootURL.appendingPathComponent(imagePath)
        if FileManager.default.fileExists(atPath: requestedURL.path) {
            return requestedURL
        }

        let directory = (imagePath as NSString).deletingLastPathComponent
        let underscoredName = (imagePath as NSString).lastPathComponent
        let compactName = underscoredName.replacingOccurrences(of: "_", with: "")
        let compactURL = directory.isEmpty
            ? rootURL.appendingPathComponent(compactName)
            : rootURL.appendingPathComponent(directory).appendingPathComponent(compactName)

        if FileManager.default.fileExists(atPath: compactURL.path) {
            print("Resolved missing image \(imagePath) as \(compactURL.path)")
            return compactURL
        }

        throw LoadError.missingImage(imagePath)
    }
}
