import Foundation
import CoreGraphics

struct PetMotion: Decodable {
    let motionVersion: Int
    let defaultMotion: String
    let motions: [String: Motion]

    struct Motion: Decodable {
        let duration: TimeInterval
        let loop: Bool
        let next: String?
        let bones: [String: [Keyframe]]
    }

    struct Keyframe: Decodable {
        let time: TimeInterval
        let rotation: CGFloat?
        let x: CGFloat?
        let y: CGFloat?
        let scale: CGFloat?
    }
}
