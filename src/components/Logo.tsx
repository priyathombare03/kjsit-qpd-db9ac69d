import logo from "@/assets/svv-logo.png";

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src={logo}
        alt="Somaiya Vidyavihar University crest"
        style={{ height: size, width: size }}
        className="object-contain"
      />
      <div className="leading-tight">
        <div className="text-brand text-sm font-semibold tracking-wide">SOMAIYA</div>
        <div className="text-muted-foreground text-[10px] uppercase tracking-widest">Vidyavihar University</div>
      </div>
    </div>
  );
}
