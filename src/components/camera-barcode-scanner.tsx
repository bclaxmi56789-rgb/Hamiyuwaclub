import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, CameraOff, RefreshCw, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraBarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function CameraBarcodeScanner({ onScan, onClose }: CameraBarcodeScannerProps) {
  const containerId = "html5-barcode-scanner-viewport";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [cameraError, setCameraError] = useState<string>("");
  const [scannedSuccess, setScannedSuccess] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize and start scanner
  useEffect(() => {
    let isMounted = true;
    const scanner = new Html5Qrcode(containerId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
      ],
      verbose: false,
    });
    scannerRef.current = scanner;

    const startScanner = async () => {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (!isMounted) return;

        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera if available
          const backCam = devices.find((d) => /back|rear|environment/i.test(d.label)) || devices[0];
          const camId = backCam?.id ?? devices[0]?.id;
          if (!camId) throw new Error("No camera id available");
          setSelectedCameraId(camId);

          await scanner.start(
            camId,
            {
              fps: 10,
              qrbox: { width: 300, height: 240 },
              aspectRatio: 1.777,
              disableFlip: false,

            },
            (decodedText) => {
              if (!isMounted) return;
              handleSuccess(decodedText);
            },
            () => {
              // frame scanned without decode - normal
            }
          );
          if (isMounted) {
            setCameraActive(true);
            setCameraError("");
          }
        } else {
          if (isMounted) {
            setCameraError("कुनै क्यामेरा फेला परेन। तल कार्ड नं. टाइप वा USB स्क्यानर प्रयोग गर्नुहोस्।");
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        if (/permission|notallowed/i.test(msg)) {
          setCameraError("क्यामेरा अनुमति अस्वीकृत भयो। कृपया ब्राउजर सेटिङमा क्यामेरा खुला गर्नुहोस्।");
        } else {
          setCameraError("क्यामेरा खोल्न सकिएन। तल कार्ड नं. टाइप वा फोटो अपलोड गर्नुहोस्।");
        }
      }
    };

    void startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            void scannerRef.current.stop().catch(() => {});
          }
          scannerRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const handleSuccess = (code: string) => {
    setScannedSuccess(code);
    try {
      // Audio beep feedback if supported
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // AudioContext not available or blocked
    }

    setTimeout(() => {
      onScan(code);
    }, 400);
  };

  const switchCamera = async () => {
    if (!scannerRef.current || cameras.length <= 1) return;
    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCam = cameras[nextIndex];
      if (!nextCam?.id) return;
      setSelectedCameraId(nextCam.id);

      await scannerRef.current.start(
        nextCam.id,
        {
          fps: 10,
          qrbox: { width: 300, height: 240 },
          aspectRatio: 1.777,
          disableFlip: false,

        },
        (decodedText) => handleSuccess(decodedText),
        () => {}
      );
      setCameraActive(true);
    } catch (err) {
      setCameraError("क्यामेरा बदल्न सकिएन: " + (err instanceof Error ? err.message : ""));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !scannerRef.current) return;
    try {
      setCameraError("");
      const result = await scannerRef.current.scanFileV2(file, true);
      if (result && result.decodedText) {
        handleSuccess(result.decodedText);
      } else {
        setCameraError("फोटोमा कुनै Barcode वा QR कोड फेला परेन।");
      }
    } catch {
      setCameraError("फोटोबाट स्क्यान गर्न सकिएन। अर्को स्पष्ट फोटो प्रयास गर्नुहोस्।");
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Live Camera Viewport */}
      <div className="relative w-full overflow-hidden rounded-xl border-2 border-primary/50 bg-black shadow-inner">
        <div id={containerId} className="w-full min-h-[220px]" />

        {/* Viewfinder Overlay with Animated Laser Line */}
        {cameraActive && !scannedSuccess && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4">
            {/* Viewfinder Target Frame */}
            <div className="relative h-44 w-64 rounded-lg border-2 border-dashed border-primary/80 bg-primary/5 shadow-[0_0_15px_rgba(37,99,235,0.2)]">
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 h-4 w-4 border-t-4 border-l-4 border-primary rounded-tl-sm" />
              <div className="absolute -top-1 -right-1 h-4 w-4 border-t-4 border-r-4 border-primary rounded-tr-sm" />
              <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-4 border-l-4 border-primary rounded-bl-sm" />
              <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-4 border-r-4 border-primary rounded-br-sm" />

              {/* Animated Laser Scanning Beam */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-[scanLaser_2s_ease-in-out_infinite]" />
            </div>
            <p className="mt-2 text-center text-xs font-semibold text-white drop-shadow bg-black/60 px-3 py-1 rounded-full">
              कार्डको QR कोड वा Barcode फ्रेमभित्र राख्नुहोस्
            </p>
          </div>
        )}

        {/* Scan Success Flash */}
        {scannedSuccess && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/80 backdrop-blur-xs text-white">
            <CheckCircle2 className="size-12 text-emerald-400 animate-bounce" />
            <p className="mt-2 font-bold text-emerald-300">स्क्यान सफल भयो!</p>
            <p className="mt-1 font-mono text-xs text-emerald-100 max-w-[80%] truncate">{scannedSuccess}</p>
          </div>
        )}

        {/* Camera Error / Not active */}
        {cameraError && !cameraActive && (
          <div className="p-6 text-center text-white bg-zinc-900 min-h-[200px] flex flex-col items-center justify-center">
            <CameraOff className="size-10 text-amber-400 mb-2" />
            <p className="text-xs text-amber-200">{cameraError}</p>
          </div>
        )}
      </div>

      {/* Camera Controls */}
      <div className="mt-2 flex w-full items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Camera className="size-3.5 text-primary" />
          <span>{cameraActive ? "लाइभ क्यामेरा सक्रिय छ" : "क्यामेरा बन्द छ"}</span>
        </div>

        <div className="flex items-center gap-2">
          {cameras.length > 1 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={switchCamera}
              className="h-7 text-xs gap-1"
              title="क्यामेरा बदल्नुहोस् (Front/Back)"
            >
              <RefreshCw className="size-3" /> क्यामेरा बदल्नुहोस्
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            title="ग्यालरी वा फोटोबाट स्क्यान गर्नुहोस्"
          >
            <Upload className="size-3" /> फोटो
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>
    </div>
  );
}
