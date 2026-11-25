import Foundation
import Vision
import ImageIO
let args = CommandLine.arguments
guard args.count > 1 else { exit(2) }
for path in args.dropFirst() {
 let request = VNDetectBarcodesRequest()
 request.symbologies = [.qr]
 do {
   try VNImageRequestHandler(url: URL(fileURLWithPath:path), options:[:]).perform([request])
   guard let observations=request.results, observations.count==1,
         let payload=observations.first?.payloadStringValue else {
    fputs("QR Vision decode failed: "+path+"\n",stderr);exit(1)
   }
   print(payload)
 }catch{fputs("QR Vision error: "+String(describing:error)+"\n",stderr);exit(1)}
}
