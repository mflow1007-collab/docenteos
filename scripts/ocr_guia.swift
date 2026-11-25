// OCR local de una guía en PDF con Vision (macOS). No envía nada fuera del equipo.
//   swift scripts/ocr_guia.swift GUIA.pdf SALIDA.json
// Escribe un arreglo JSON: el texto de cada página, en orden.
import Foundation
import PDFKit
import Vision
import AppKit
let a = CommandLine.arguments
guard a.count == 3 else { fputs("Uso: swift scripts/ocr_guia.swift GUIA.pdf SALIDA.json\n", stderr); exit(1) }
let doc = PDFDocument(url: URL(fileURLWithPath: a[1]))!
var out: [String] = []
for n in 0..<doc.pageCount {
  let pg = doc.page(at: n)!
  let r = pg.bounds(for: .cropBox); let k: CGFloat = 3
  let w = Int(r.width * k), h = Int(r.height * k)
  let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1)); ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
  ctx.scaleBy(x: k, y: k); pg.draw(with: .cropBox, to: ctx)
  let q = VNRecognizeTextRequest(); q.recognitionLevel = .accurate; q.recognitionLanguages = ["es-ES"]; q.usesLanguageCorrection = true
  try! VNImageRequestHandler(cgImage: ctx.makeImage()!, options: [:]).perform([q])
  out.append((q.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n"))
}
try! JSONSerialization.data(withJSONObject: out).write(to: URL(fileURLWithPath: a[2]))
