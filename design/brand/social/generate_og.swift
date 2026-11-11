#!/usr/bin/env swift
// Imagen social vectorial; requiere macOS y Swift, sin paquetes ni red.
import Foundation
import CoreGraphics
import CoreText
import ImageIO
import CryptoKit

let output = URL(fileURLWithPath: #filePath).standardizedFileURL.deletingLastPathComponent()
let brand = output.deletingLastPathComponent()
let root = brand.deletingLastPathComponent().deletingLastPathComponent()
let fonts = root.appendingPathComponent("node_modules/.pnpm/@expo-google-fonts+fira-sans@0.4.1/node_modules/@expo-google-fonts/fira-sans")
let width = 1200, height = 630
let navy = "#1d3343", white = "#ffffff", yellow = "#ffcd02", blue = "#035c80"
struct Shape { let path: CGPath; let fill: String }
var shapes: [Shape] = []

func color(_ hex: String) -> CGColor {
    let value = UInt32(hex.dropFirst(), radix: 16)!
    return CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: [
        CGFloat((value >> 16) & 255) / 255, CGFloat((value >> 8) & 255) / 255,
        CGFloat(value & 255) / 255, 1])!
}
func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ fill: String, radius: CGFloat = 0) {
    let bounds = CGRect(x: x, y: y, width: w, height: h)
    shapes.append(Shape(path: CGPath(roundedRect: bounds, cornerWidth: radius, cornerHeight: radius, transform: nil), fill: fill))
}
func numbers(_ text: String) -> [CGFloat] {
    let pattern = try! NSRegularExpression(pattern: "-?[0-9]+(?:\\.[0-9]+)?")
    return pattern.matches(in: text, range: NSRange(text.startIndex..., in: text)).map {
        CGFloat(Double((text as NSString).substring(with: $0.range))!)
    }
}
func pathData(_ source: String) -> CGPath {
    let regex = try! NSRegularExpression(pattern: "[A-Za-z]|-?[0-9]+(?:\\.[0-9]+)?")
    let tokens = regex.matches(in: source, range: NSRange(source.startIndex..., in: source)).map {
        (source as NSString).substring(with: $0.range)
    }
    let path = CGMutablePath()
    var i = 0
    func number() -> CGFloat { defer { i += 1 }; return CGFloat(Double(tokens[i])!) }
    func point() -> CGPoint { let x = number(); return CGPoint(x: x, y: number()) }
    while i < tokens.count {
        let command = tokens[i]; i += 1
        switch command {
        case "M": path.move(to: point())
        case "L": path.addLine(to: point())
        case "H": path.addLine(to: CGPoint(x: number(), y: path.currentPoint.y))
        case "V": path.addLine(to: CGPoint(x: path.currentPoint.x, y: number()))
        case "Q": let control = point(); path.addQuadCurve(to: point(), control: control)
        case "C": let first = point(); let second = point(); path.addCurve(to: point(), control1: first, control2: second)
        case "Z": path.closeSubpath()
        default: fatalError("Comando de mark.svg no admitido: \(command)")
        }
    }
    return path
}
final class MarkReader: NSObject, XMLParserDelegate {
    var count = 0
    func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?, qualifiedName: String?, attributes a: [String: String]) {
        guard let fill = ["primary": navy, "mark": white, "accent": yellow][a["class"] ?? ""] else { return }
        precondition(a["transform"] == nil && a["stroke"] == nil)
        func n(_ key: String) -> CGFloat { CGFloat(Double(a[key] ?? "0")!) }
        let path: CGPath
        switch name {
        case "rect": path = CGPath(roundedRect: CGRect(x: n("x"), y: n("y"), width: n("width"), height: n("height")), cornerWidth: n("rx"), cornerHeight: n("rx"), transform: nil)
        case "circle": path = CGPath(ellipseIn: CGRect(x: n("cx") - n("r"), y: n("cy") - n("r"), width: 2 * n("r"), height: 2 * n("r")), transform: nil)
        case "polygon":
            let values = numbers(a["points"]!), polygon = CGMutablePath()
            polygon.move(to: CGPoint(x: values[0], y: values[1]))
            for i in stride(from: 2, to: values.count, by: 2) { polygon.addLine(to: CGPoint(x: values[i], y: values[i + 1])) }
            polygon.closeSubpath(); path = polygon
        case "path": path = pathData(a["d"]!)
        default: fatalError("Elemento de mark.svg no admitido: \(name)")
        }
        // Escala uniforme: caja visible (164, 167.68)–(440, 462.08).
        var transform = CGAffineTransform(a: 0.46, b: 0, c: 0, d: 0.46, tx: 62.8, ty: 72)
        shapes.append(Shape(path: path.copy(using: &transform)!, fill: fill)); count += 1
    }
}

func font(_ directory: String, _ file: String, _ expected: String, size: CGFloat) -> CTFont {
    let url = fonts.appendingPathComponent(directory).appendingPathComponent(file)
    let data = try! Data(contentsOf: url)
    let graphicsFont = CGFont(CGDataProvider(data: data as CFData)!)!
    precondition(graphicsFont.postScriptName as String? == expected, "El TTF no es \(expected)")
    let result = CTFontCreateWithGraphicsFont(graphicsFont, size, nil, nil)
    precondition(CTFontCopyPostScriptName(result) as String == expected)
    print("Fuente verificada: \(file), PostScript=\(expected), SHA256=\(SHA256.hash(data: data))")
    return result
}
let bold = font("700Bold", "FiraSans_700Bold.ttf", "FiraSans-Bold", size: 90)
let semibold = font("600SemiBold", "FiraSans_600SemiBold.ttf", "FiraSans-SemiBold", size: 20)
let regular = font("400Regular", "FiraSans_400Regular.ttf", "FiraSans-Regular", size: 36)

func text(_ value: String, _ font: CTFont, x: CGFloat, baseline: CGFloat) {
    // CGFont se carga desde el TTF exacto; no interviene la búsqueda de familias.
    let characters = Array(value.utf16)
    var glyphs = [CGGlyph](repeating: 0, count: characters.count)
    precondition(CTFontGetGlyphsForCharacters(font, characters, &glyphs, characters.count), "Falta un glifo en Fira Sans")
    precondition(!glyphs.contains(0))
    var advances = [CGSize](repeating: .zero, count: glyphs.count)
    CTFontGetAdvancesForGlyphs(font, .horizontal, glyphs, &advances, glyphs.count)
    let outline = CGMutablePath()
    var cursor = x
    for (index, glyph) in glyphs.enumerated() {
        if let path = CTFontCreatePathForGlyph(font, glyph, nil) {
            let transform = CGAffineTransform(a: 1, b: 0, c: 0, d: -1, tx: cursor, ty: baseline)
            outline.addPath(path, transform: transform)
        }
        cursor += advances[index].width
    }
    let bounds = outline.boundingBoxOfPath
    precondition(bounds.minX >= 60 && bounds.minY >= 60 && bounds.maxX <= 1140 && bounds.maxY <= 570, "Texto fuera de zona segura: \(value)")
    shapes.append(Shape(path: outline, fill: white))
    print("Texto en contornos: \(value), caja=\(bounds)")
}

rect(0, 0, 1200, 630, navy)
let reader = MarkReader()
let parser = XMLParser(data: try! Data(contentsOf: brand.appendingPathComponent("mark.svg")))
parser.delegate = reader
precondition(parser.parse() && reader.count == 9, "No se pudo leer mark.svg completo")
rect(498, 168, 150, 36, blue, radius: 6)
text("Buenos Aires", semibold, x: 514, baseline: 193)
text("Transportate", bold, x: 498, baseline: 291)
text("Subte, colectivos y trenes", regular, x: 498, baseline: 356)
text("en tiempo real", regular, x: 498, baseline: 402)

func decimal(_ number: CGFloat) -> String {
    let value = abs(number) < 0.0005 ? 0 : number
    return String(format: "%.3f", locale: Locale(identifier: "en_US_POSIX"), Double(value))
}
func svgPath(_ path: CGPath) -> String {
    var parts: [String] = []
    func point(_ p: CGPoint) -> String { "\(decimal(p.x)) \(decimal(p.y))" }
    path.applyWithBlock { pointer in
        let e = pointer.pointee
        switch e.type {
        case .moveToPoint: parts.append("M\(point(e.points[0]))")
        case .addLineToPoint: parts.append("L\(point(e.points[0]))")
        case .addQuadCurveToPoint: parts.append("Q\(point(e.points[0])) \(point(e.points[1]))")
        case .addCurveToPoint: parts.append("C\(point(e.points[0])) \(point(e.points[1])) \(point(e.points[2]))")
        case .closeSubpath: parts.append("Z")
        @unknown default: fatalError("Elemento de contorno no admitido")
        }
    }
    return parts.joined(separator: " ")
}
let svg = """
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title description">
  <title id="title">Transportate — Buenos Aires</title>
  <desc id="description">Subte, colectivos y trenes en tiempo real. Isotipo Subte conectado; textos en contornos de Fira Sans 700, 600 y 400, licencia SIL OFL.</desc>
\(shapes.map { "  <path fill=\"\($0.fill)\" d=\"\(svgPath($0.path))\"/>" }.joined(separator: "\n"))
</svg>

"""
let space = CGColorSpace(name: CGColorSpace.sRGB)!
let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
context.translateBy(x: 0, y: CGFloat(height)); context.scaleBy(x: 1, y: -1)
context.setAllowsAntialiasing(true); context.setShouldAntialias(true)
for shape in shapes { context.setFillColor(color(shape.fill)); context.addPath(shape.path); context.fillPath() }
let encoded = NSMutableData()
let destination = CGImageDestinationCreateWithData(encoded, "public.png" as CFString, 1, nil)!
CGImageDestinationAddImage(destination, context.makeImage()!, nil)
precondition(CGImageDestinationFinalize(destination))

func uint32(_ value: UInt32) -> Data { var big = value.bigEndian; return withUnsafeBytes(of: &big) { Data($0) } }
func read32(_ data: Data, _ offset: Int) -> Int { data[offset..<(offset + 4)].reduce(0) { ($0 << 8) | Int($1) } }
func chunk(_ type: String, _ payload: Data) -> Data {
    let body = Data(type.utf8) + payload
    var crc: UInt32 = 0xffffffff
    for byte in body {
        crc ^= UInt32(byte)
        for _ in 0..<8 { crc = (crc >> 1) ^ (crc & 1 == 1 ? 0xedb88320 : 0) }
    }
    return uint32(UInt32(payload.count)) + body + uint32(crc ^ 0xffffffff)
}
// Conservar solo píxeles y declaración sRGB; eliminar perfil y metadatos de ImageIO.
let raw = encoded as Data
var png = raw.prefix(8), offset = 8, chunks: [String] = []
while offset < raw.count {
    let length = read32(raw, offset)
    let type = String(data: raw[(offset + 4)..<(offset + 8)], encoding: .ascii)!
    if ["IHDR", "IDAT", "IEND"].contains(type) {
        if type == "IHDR" {
            precondition(read32(raw, offset + 8) == width && read32(raw, offset + 12) == height)
            precondition(raw[offset + 17] == 2, "El PNG debe ser RGB opaco")
        }
        png.append(raw[offset..<(offset + length + 12)]); chunks.append(type)
        if type == "IHDR" { png.append(chunk("sRGB", Data([0]))); chunks.append("sRGB") }
    }
    offset += length + 12
}
precondition(png.count < 300_000, "El PNG excede 300 KB")
let pngURL = output.appendingPathComponent("og-1200x630.png")
let svgURL = output.appendingPathComponent("og.svg")
if CommandLine.arguments.contains("--check") {
    precondition(try! Data(contentsOf: pngURL) == png, "PNG desactualizado")
    precondition(try! String(contentsOf: svgURL, encoding: .utf8) == svg, "SVG desactualizado")
    print("Verificación reproducible OK")
} else {
    try png.write(to: pngURL)
    try svg.write(to: svgURL, atomically: true, encoding: .utf8)
}
print("og-1200x630.png: \(width)×\(height), RGB opaco, sRGB, \(png.count) bytes; chunks: \(chunks.joined(separator: ", "))")
