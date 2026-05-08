import Foundation
import CoreGraphics
import QuartzCore

final class PetAnimator {
    private let motion: PetMotion
    private(set) var currentMotionName: String
    private var motionStartTime: CFTimeInterval

    init(motion: PetMotion, startTime: CFTimeInterval = CACurrentMediaTime()) {
        self.motion = motion
        self.currentMotionName = motion.defaultMotion
        self.motionStartTime = startTime
    }

    func play(_ motionName: String, at now: CFTimeInterval = CACurrentMediaTime()) {
        guard motion.motions[motionName] != nil,
              motionName != currentMotionName else { return }

        currentMotionName = motionName
        motionStartTime = now
    }

    func rotation(for bone: String, at now: CFTimeInterval) -> CGFloat {
        guard let currentMotion = motion.motions[currentMotionName],
              let keyframes = keyframes(for: bone, in: currentMotion) else {
            return 0
        }

        let time = localTime(for: currentMotion, now: now)
        return Self.interpolateRotation(keyframes: keyframes, time: time)
    }

    private func keyframes(for bone: String, in motion: PetMotion.Motion) -> [PetMotion.Keyframe]? {
        if let exact = motion.bones[bone] {
            return exact
        }

        let normalizedBone = Self.normalizeBoneName(bone)
        return motion.bones.first { motionBone, _ in
            Self.normalizeBoneName(motionBone) == normalizedBone
        }?.value
    }

    private static func normalizeBoneName(_ bone: String) -> String {
        bone
            .replacingOccurrences(of: "_", with: "")
            .replacingOccurrences(of: "-", with: "")
            .lowercased()
    }

    private func localTime(for motion: PetMotion.Motion, now: CFTimeInterval) -> TimeInterval {
        let elapsed = max(0, now - motionStartTime)
        guard motion.duration > 0 else { return 0 }

        if motion.loop {
            return elapsed.truncatingRemainder(dividingBy: motion.duration)
        }

        if elapsed >= motion.duration, let next = motion.next, self.motion.motions[next] != nil {
            currentMotionName = next
            motionStartTime = now
            return 0
        }

        return min(elapsed, motion.duration)
    }

    static func interpolateRotation(keyframes: [PetMotion.Keyframe], time: TimeInterval) -> CGFloat {
        let frames = keyframes
            .filter { $0.rotation != nil }
            .sorted { $0.time < $1.time }

        guard let first = frames.first else { return 0 }
        guard time > first.time else { return first.rotation ?? 0 }

        for index in 0..<(frames.count - 1) {
            let left = frames[index]
            let right = frames[index + 1]
            if time >= left.time && time <= right.time {
                let span = right.time - left.time
                guard span > 0 else { return right.rotation ?? left.rotation ?? 0 }

                let progress = CGFloat((time - left.time) / span)
                let leftRotation = left.rotation ?? 0
                let rightRotation = right.rotation ?? leftRotation
                return leftRotation + (rightRotation - leftRotation) * progress
            }
        }

        return frames.last?.rotation ?? 0
    }
}
