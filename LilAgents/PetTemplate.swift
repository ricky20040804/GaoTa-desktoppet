import CoreGraphics

struct PetTemplate: Decodable {
    let templateId: String?
    let canvas: Canvas
    let parts: [String: Part]

    struct Canvas: Decodable {
        let width: CGFloat
        let height: CGFloat
    }

    struct Part: Decodable {
        let image: String
        let bone: String
        let position: Point
        let pivot: Point
        let size: Size
        let scale: CGFloat?
        let rotation: CGFloat?
        let zIndex: Int
    }

    struct Point: Decodable {
        let x: CGFloat
        let y: CGFloat
    }

    struct Size: Decodable {
        let width: CGFloat
        let height: CGFloat
    }
}
