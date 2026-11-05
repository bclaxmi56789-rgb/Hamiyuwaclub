import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  ArrowRight,
  Megaphone,
  Users,
  Leaf,
  Award,
  Globe,
  Network,
  CheckCircle2,
  Compass,
  ExternalLink,
  Menu,
  X,
  HeartHandshake,
  BookOpen,
  MapPin,
  ChevronRight,
  ShieldCheck,
  Receipt,
  Layers,
  Lock,
  ArrowUpRight,
  Boxes,
} from "lucide-react";
import { useAppConfig } from "@/lib/app-config";
import { ThemeSelector } from "@/components/theme-selector";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "संस्था पोर्टल" },
      {
        name: "description",
        content:
          "एकीकृत संस्था व्यवस्थापन पोर्टल। डिजिटल युगको सम्भावनालाई आत्मसात् गर्दै एक सजग, समावेशी र भविष्यमुखी समाजको निर्माण।",
      },
      { property: "og:title", content: "संस्था पोर्टल।" },
      {
        property: "og:description",
        content:
          "एकीकृत संस्था व्यवस्थापन पोर्टल। युवा वकालत, सामुदायिक कार्य, वातावरण र नेतृत्व।",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: LandingPage,
});

export function LandingPage() {
  const appConfig = useAppConfig();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 selection:text-primary overflow-x-hidden">
      {/* ────────────────── TOP ANNOUNCEMENT BAR ────────────────── */}
      <div className="border-b bg-card/60 backdrop-blur-md text-muted-foreground text-xs py-2 px-4 shadow-xs relative z-50">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span>{appConfig.address}</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="hidden sm:inline font-medium">युवा सोच, सशक्त राष्ट्र!</span>
            {/* Prasanik Portal Header Link */}
            <Link
              to="/"
              className="group inline-flex items-center gap-1.5 font-bold text-primary hover:text-primary/80 transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary group-hover:scale-110 transition-transform" />
              <span>प्रशासनिक पोर्टल (Staff Login)</span>
              <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* ────────────────── 3D FLOATING STICKY HEADER ────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.07)] transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* Logo with 3D Depth Frame */}
          <Link to="/landing" className="flex items-center gap-3.5 group">
            <div className="relative rounded-2xl p-1 bg-gradient-to-br from-card to-muted border shadow-[0_4px_12px_rgba(0,0,0,0.08)] group-hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)] group-hover:-translate-y-0.5 transition-all duration-300">
              <img
                src={appConfig.logo_url || ""}
                alt={appConfig.entity_name || ""}
                onError={(e) => {
                  (e.target as HTMLImageElement).removeAttribute("src");
                }}
                className="size-11 sm:size-12 object-contain rounded-xl bg-card p-1"
              />
              <span className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-emerald-500 ring-2 ring-background" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black tracking-tight leading-tight text-foreground flex items-center gap-1.5">
                {appConfig.entity_name}
              </span>
              <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                {appConfig.entity_sub_name}
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-bold text-foreground/80">
            <a
              href="#kaam"
              className="hover:text-primary transition-colors hover:-translate-y-0.5 transform duration-150"
            >
              हाम्रो काम
            </a>
            <a
              href="#digital"
              className="hover:text-primary transition-colors hover:-translate-y-0.5 transform duration-150"
            >
              डिजिटल समाज
            </a>
            <a
              href="#katha"
              className="hover:text-primary transition-colors hover:-translate-y-0.5 transform duration-150"
            >
              कथाहरू
            </a>
            <a
              href="https://staff.hyc.com.np"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors flex items-center gap-1 hover:-translate-y-0.5 transform duration-150"
            >
              <span>सदस्यता</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </a>
          </nav>

          {/* Actions: Prasanik Portal 3D Button + Theme Selector */}
          <div className="flex items-center gap-2.5">
            <ThemeSelector />

            {/* 3D Elevated Prasanik Portal Button in Navbar */}
            <Button
              asChild
              size="sm"
              className="hidden sm:inline-flex rounded-xl px-4 h-10 gap-2 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0.5 border-b-2 border-black/25 transition-all"
            >
              <Link to="/">
                <ShieldCheck className="h-4 w-4" />
                <span>प्रशासनिक पोर्टल</span>
              </Link>
            </Button>

            {/* Mobile Hamburger */}
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden rounded-xl"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b bg-card/95 backdrop-blur-xl px-5 pt-3 pb-6 space-y-3 shadow-2xl animate-in slide-in-from-top-2">
            <a
              href="#kaam"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-sm font-bold hover:bg-muted"
            >
              हाम्रो काम
            </a>
            <a
              href="#digital"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-sm font-bold hover:bg-muted"
            >
              डिजिटल समाज
            </a>
            <a
              href="#katha"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-xl text-sm font-bold hover:bg-muted"
            >
              कथाहरू
            </a>
            <a
              href="https://staff.hyc.com.np"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold hover:bg-muted text-primary"
            >
              <span>सदस्यता (Staff / Member Portal)</span>
              <ExternalLink className="h-4 w-4" />
            </a>
            <div className="pt-3 border-t flex flex-col gap-2.5">
              <Button asChild className="w-full justify-center h-11 font-bold shadow-md rounded-xl">
                <Link to="/">
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  प्रशासनिक पोर्टल (Staff Login)
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-center h-11 font-bold rounded-xl">
                <a
                  href="https://staff.hyc.com.np"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  सदस्यताका लागि आवेदन दिनुहोस्
                </a>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* ────────────────── 3D HERO SECTION ────────────────── */}
      <section className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32 border-b">
        {/* Layered 3D Ambient Orbs */}
        <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
          <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/20 dark:bg-primary/15 rounded-full blur-[100px]" />
          <div className="absolute -top-10 left-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute top-40 right-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-8">
          {/* 3D Elevated Tagline Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border bg-card/90 backdrop-blur-md text-xs sm:text-sm font-bold text-foreground shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 transition-all">
            <span className="flex h-2.5 w-2.5 rounded-full bg-primary animate-ping" />
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>{appConfig.address}</span>
          </div>

          {/* 3D Styled Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-foreground leading-[1.12]">
            युवा सोच, <span className="bg-gradient-to-r from-primary via-primary/90 to-emerald-600 bg-clip-text text-transparent">सशक्त राष्ट्र।</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed">
            डिजिटल युगको सम्भावनालाई आत्मसात् गर्दै, हामी एक सजग, समावेशी र भविष्यमुखी समाजको आधारशिला निर्माण गरिरहेका छौं।
          </p>

          {/* 3D Hero Action Cards & Buttons */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            {/* Primary Membership Button with 3D Depth */}
            <Button
              asChild
              size="lg"
              className="rounded-2xl px-8 h-14 text-base font-extrabold shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.25)] hover:-translate-y-1 active:translate-y-0.5 border-b-4 border-black/30 transition-all gap-2"
            >
              <a
                href="https://staff.hyc.com.np"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>सदस्यताका लागि आवेदन दिनुहोस्</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>

            {/* Prominent 3D Prasanik Portal Button */}
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-2xl px-7 h-14 text-base font-bold bg-card/80 backdrop-blur-md border-2 border-primary/30 shadow-[0_6px_20px_rgba(0,0,0,0.08)] hover:shadow-[0_10px_28px_rgba(0,0,0,0.16)] hover:-translate-y-1 active:translate-y-0.5 transition-all gap-2.5 text-foreground hover:bg-card hover:border-primary"
            >
              <Link to="/">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span>प्रशासनिक पोर्टल (प्रवेश)</span>
              </Link>
            </Button>

            {/* Work details anchor */}
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="rounded-2xl px-6 h-14 text-sm font-semibold hover:bg-muted"
            >
              <a href="#kaam">
                <span>हाम्रो काम हेर्नुहोस् ↓</span>
              </a>
            </Button>
          </div>

          {/* 4 Interactive 3D Stats Cards */}
          <div className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 max-w-4xl mx-auto text-left">
            <div className="group rounded-3xl border bg-card/70 backdrop-blur-xl p-5 shadow-[0_10px_25px_rgba(0,0,0,0.05)] hover:shadow-[0_18px_35px_rgba(0,0,0,0.12)] hover:-translate-y-1.5 transition-all duration-300">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold mb-3 shadow-xs">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-primary">१००%</div>
              <div className="text-xs sm:text-sm text-muted-foreground font-semibold mt-1">युवा नेतृत्व र सञ्चालन</div>
            </div>

            <div className="group rounded-3xl border bg-card/70 backdrop-blur-xl p-5 shadow-[0_10px_25px_rgba(0,0,0,0.05)] hover:shadow-[0_18px_35px_rgba(0,0,0,0.12)] hover:-translate-y-1.5 transition-all duration-300">
              <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold mb-3 shadow-xs">
                <Leaf className="h-5 w-5" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-foreground">१६+</div>
              <div className="text-xs sm:text-sm text-muted-foreground font-semibold mt-1">वडास्तरीय सरसफाइ अभियान</div>
            </div>

            <div className="group rounded-3xl border bg-card/70 backdrop-blur-xl p-5 shadow-[0_10px_25px_rgba(0,0,0,0.05)] hover:shadow-[0_18px_35px_rgba(0,0,0,0.12)] hover:-translate-y-1.5 transition-all duration-300">
              <div className="size-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold mb-3 shadow-xs">
                <Receipt className="h-5 w-5" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-primary">डिजिटल</div>
              <div className="text-xs sm:text-sm text-muted-foreground font-semibold mt-1">पारदर्शी रसिद र व्यवस्थापन</div>
            </div>

            <div className="group rounded-3xl border bg-card/70 backdrop-blur-xl p-5 shadow-[0_10px_25px_rgba(0,0,0,0.05)] hover:shadow-[0_18px_35px_rgba(0,0,0,0.12)] hover:-translate-y-1.5 transition-all duration-300">
              <div className="size-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold mb-3 shadow-xs">
                <Award className="h-5 w-5" />
              </div>
              <div className="text-2xl sm:text-3xl font-black text-foreground">कर्णाली</div>
              <div className="text-xs sm:text-sm text-muted-foreground font-semibold mt-1">सशक्त, हरित र दिगो</div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── 3D MISSION STATEMENT (हाम्रो ध्येय) ────────────────── */}
      <section className="py-20 sm:py-24 border-b bg-muted/20 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <Badge
            variant="outline"
            className="px-4 py-1.5 rounded-full border-primary/30 text-primary font-bold text-xs shadow-xs"
          >
            <Compass className="h-3.5 w-3.5 mr-1.5 text-primary" />
            हाम्रो ध्येय · Our Mission
          </Badge>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight">
            हाम्रो ध्येय
          </h2>

          {/* 3D Floating Quote Box */}
          <div className="relative mt-8 p-8 sm:p-12 rounded-3xl border bg-card/90 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:shadow-[0_28px_60px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-300">
            <div className="text-4xl text-primary/30 font-serif leading-none mb-3">“</div>
            <p className="text-xl sm:text-2xl md:text-3xl font-bold leading-relaxed text-foreground/90">
              प्रत्येक युवालाई स्वर, आत्मविश्वास र परिवर्तनको नेतृत्व गर्ने अवसर उपलब्ध गराउँदै एक सशक्त भविष्यको परिकल्पना।
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs font-black text-primary uppercase tracking-widest">
              <span>{appConfig.entity_name}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── 3D FOUR PILLARS SECTION (चार आधारस्तम्भ, एउटै परिकल्पना) ────────────────── */}
      <section id="kaam" className="py-24 sm:py-28 border-b scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-14">
          {/* Section Header */}
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <Badge variant="outline" className="px-4 py-1.5 rounded-full border-primary/30 text-primary font-bold text-xs shadow-xs">
              हाम्रो काम · सामाजिक रूपान्तरण
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
              चार आधारस्तम्भ, एउटै परिकल्पना
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground font-medium leading-relaxed">
              युवाद्वारा सञ्चालित सामुदायिक संस्थाका रूपमा हामी स्थानीय नेतृत्वसँग प्रत्यक्ष संवाद स्थापित गर्दै स्वयंसेवामा आधारित सामाजिक रूपान्तरणमा सक्रिय छौं।
            </p>
          </div>

          {/* 3D Elevated Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
            {/* Pillar 1: युवा वकालत */}
            <div className="group rounded-3xl border bg-card/85 backdrop-blur-xl p-8 sm:p-10 shadow-[0_12px_30px_rgba(0,0,0,0.06)] hover:shadow-[0_22px_50px_rgba(0,0,0,0.14)] hover:-translate-y-2 hover:border-amber-500/50 transition-all duration-300 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-[0_8px_20px_rgba(245,158,11,0.2)] group-hover:scale-110 group-hover:rotate-2 transition-all">
                  <Megaphone className="h-8 w-8" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-foreground">
                  युवा वकालत
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  शिक्षा, रोजगारी र मानसिक स्वास्थ्यजस्ता सरोकारका विषयमा युवाको सशक्त प्रतिनिधित्व सुनिश्चित गर्ने मञ्च।
                </p>
              </div>
              <div className="pt-6 mt-6 border-t flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                <span>स्थानीय तहसँग प्रत्यक्ष संवाद र नीतिगत पैरवी</span>
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Pillar 2: सामुदायिक कार्य */}
            <div className="group rounded-3xl border bg-card/85 backdrop-blur-xl p-8 sm:p-10 shadow-[0_12px_30px_rgba(0,0,0,0.06)] hover:shadow-[0_22px_50px_rgba(0,0,0,0.14)] hover:-translate-y-2 hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-[0_8px_20px_rgba(59,130,246,0.2)] group-hover:scale-110 group-hover:-rotate-2 transition-all">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-foreground">
                  सामुदायिक कार्य
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  स्थानीय निकायसँगको सहकार्यमा समुदायका यथार्थ चुनौतीको दिगो समाधानतर्फ अग्रसर।
                </p>
              </div>
              <div className="pt-6 mt-6 border-t flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400">
                <span>दिगो सहकार्य र प्रभावकारी कार्यान्वयन</span>
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Pillar 3: वातावरण */}
            <div className="group rounded-3xl border bg-card/85 backdrop-blur-xl p-8 sm:p-10 shadow-[0_12px_30px_rgba(0,0,0,0.06)] hover:shadow-[0_22px_50px_rgba(0,0,0,0.14)] hover:-translate-y-2 hover:border-emerald-500/50 transition-all duration-300 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-[0_8px_20px_rgba(16,185,129,0.2)] group-hover:scale-110 group-hover:rotate-2 transition-all">
                  <Leaf className="h-8 w-8" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-foreground">
                  वातावरण
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  सरसफाइ अभियान र फोहोरमुक्त वडाको पहलमार्फत स्वच्छ, हरित र दिगो सहरको निर्माण।
                </p>
              </div>
              <div className="pt-6 mt-6 border-t flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span>फोहोर व्यवस्थापन र हरित बीरेन्द्रनगर</span>
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Pillar 4: नेतृत्व */}
            <div className="group rounded-3xl border bg-card/85 backdrop-blur-xl p-8 sm:p-10 shadow-[0_12px_30px_rgba(0,0,0,0.06)] hover:shadow-[0_22px_50px_rgba(0,0,0,0.14)] hover:-translate-y-2 hover:border-purple-500/50 transition-all duration-300 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="size-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-[0_8px_20px_rgba(168,85,247,0.2)] group-hover:scale-110 group-hover:-rotate-2 transition-all">
                  <Award className="h-8 w-8" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-foreground">
                  नेतृत्व
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  आत्मविश्वासी, उत्तरदायी र परिवर्तनकारी नयाँ पुस्ताको नेतृत्व विकास।
                </p>
              </div>
              <div className="pt-6 mt-6 border-t flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400">
                <span>नयाँ पुस्ताको सशक्त क्षमता विकास</span>
                <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── 3D DIGITAL SOCIETY SECTION (डिजिटल–मैत्री समाजतर्फको यात्रा) ────────────────── */}
      <section id="digital" className="py-24 sm:py-28 border-b bg-muted/30 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-14">
          {/* Section Header */}
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <Badge variant="outline" className="px-4 py-1.5 rounded-full border-primary/30 text-primary font-bold text-xs shadow-xs">
              <Globe className="h-3.5 w-3.5 mr-1.5" />
              प्रविधि र भविष्य · Digital Transformation
            </Badge>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
              डिजिटल–मैत्री समाजतर्फको यात्रा
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground font-medium leading-relaxed">
              आगामी युग प्रविधिमय छ। हामी यस्तो समाजको परिकल्पना गर्छौं, जहाँ प्रत्येक युवाको स्वर सहज रूपमा सुनियोस्, सूचनामा सबैको पहुँच होस् र अवसर सबैका लागि समान रूपमा खुला रहून्।
            </p>
          </div>

          {/* 3 Step 3D Road-map Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="group rounded-3xl border bg-card/90 backdrop-blur-xl p-8 space-y-5 shadow-[0_10px_25px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_45px_rgba(0,0,0,0.12)] hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
              <div className="size-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black text-xl shadow-[0_6px_16px_rgba(0,0,0,0.2)] border-b-4 border-black/30 group-hover:scale-105 transition-transform">
                ०१
              </div>
              <h3 className="text-2xl font-black text-foreground">
                स्वर बुलन्द गरौं
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                खुला संवाद र टाउन हलजस्ता मञ्चमार्फत युवाका सरोकार नीतिनिर्माताहरूसम्म पुर्‍याइन्छ।
              </p>
            </div>

            {/* Step 2 */}
            <div className="group rounded-3xl border bg-card/90 backdrop-blur-xl p-8 space-y-5 shadow-[0_10px_25px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_45px_rgba(0,0,0,0.12)] hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
              <div className="size-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black text-xl shadow-[0_6px_16px_rgba(0,0,0,0.2)] border-b-4 border-black/30 group-hover:scale-105 transition-transform">
                ०२
              </div>
              <h3 className="text-2xl font-black text-foreground">
                सञ्जाल निर्माण
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                स्वयंसेवक, सहकर्मी र स्थानीय निकायबीच अनलाइन र अफलाइन दुवै माध्यमबाट सुदृढ सहकार्य।
              </p>
            </div>

            {/* Step 3 */}
            <div className="group rounded-3xl border bg-card/90 backdrop-blur-xl p-8 space-y-5 shadow-[0_10px_25px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_45px_rgba(0,0,0,0.12)] hover:-translate-y-2 transition-all duration-300 relative overflow-hidden">
              <div className="size-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black text-xl shadow-[0_6px_16px_rgba(0,0,0,0.2)] border-b-4 border-black/30 group-hover:scale-105 transition-transform">
                ०३
              </div>
              <h3 className="text-2xl font-black text-foreground">
                कार्यान्वयन
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                संवादबाट निष्कर्ष र निष्कर्षबाट अभियान — सरसफाइदेखि सीप विकाससम्म।
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── 3D PRASANIK PORTAL SHOWCASE BANNER ────────────────── */}
      <section className="py-16 sm:py-20 border-b bg-gradient-to-r from-card via-card/90 to-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-card via-primary/[0.04] to-card p-8 sm:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.09)] hover:shadow-[0_28px_65px_rgba(0,0,0,0.15)] transition-all duration-300 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                <ShieldCheck className="h-4 w-4" />
                <span>संस्थागत कार्यक्षेत्र · Official Portal</span>
              </div>
              <h3 className="text-2xl sm:text-4xl font-black text-foreground tracking-tight">
                प्रशासनिक तथा रसिद संकलन पोर्टल
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                संस्थाका कर्मचारी तथा वडा अधिकृतहरूका लागि रसिद संकलन, खर्च तथा बिल स्क्यान (AI OCR), मिटिङ मिनेट, सामग्री (Item Master), र स्थिर सम्पत्ति (Fixed Assets) व्यवस्थापन गर्ने एकीकृत प्रणाली।
              </p>
            </div>

            <div className="shrink-0 flex flex-col sm:flex-row gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-2xl px-8 h-14 font-extrabold shadow-lg hover:shadow-xl hover:-translate-y-1 active:translate-y-0.5 border-b-4 border-black/30 gap-2"
              >
                <Link to="/">
                  <Lock className="h-4 w-4" />
                  <span>प्रशासनिक पोर्टल प्रवेश</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ────────────────── 3D INSPIRING STORIES SECTION (प्रेरक कथाहरू) ────────────────── */}
      <section id="katha" className="py-24 sm:py-28 border-b scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-14">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b pb-6">
            <div className="space-y-2">
              <Badge variant="outline" className="px-3.5 py-1 rounded-full border-primary/30 text-primary font-bold text-xs">
                <BookOpen className="h-3.5 w-3.5 mr-1.5" />
                हाम्रो प्रभाव · Success Stories
              </Badge>
              <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
                प्रेरक कथाहरू
              </h2>
            </div>
            <a
              href="https://hyc.com.np/stories/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-bold text-primary hover:underline flex items-center gap-1.5"
            >
              <span>सबै कथाहरू हेर्नुहोस्</span>
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          {/* 3D Stories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Story 1 */}
            <article className="group rounded-3xl border bg-card/90 backdrop-blur-xl overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.06)] hover:shadow-[0_22px_55px_rgba(0,0,0,0.13)] hover:-translate-y-2 transition-all duration-300 flex flex-col justify-between">
              <div className="p-8 sm:p-10 space-y-5">
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold text-xs px-3 py-1 rounded-full"
                >
                  वातावरण · विशेष कार्य
                </Badge>
                <h3 className="text-2xl sm:text-3xl font-black text-foreground leading-tight group-hover:text-primary transition-colors">
                  सरसफाइ अभियानले रूपान्तरित बीरेन्द्रनगर
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  नियमित सरसफाइ पहलले फोहोर व्यवस्थापनको चुनौतीलाई सम्बोधन गर्दै सामुदायिक सहभागिता, युवा नेतृत्व र स्थानीय निकायसँगको साझेदारी सुदृढ बनाएका छन्।
                </p>
              </div>
              <div className="px-8 sm:px-10 pb-8 pt-3 border-t">
                <a
                  href="https://hyc.com.np/stories/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-extrabold text-primary hover:underline underline-offset-4"
                >
                  <span>पूर्ण कथा पढ्नुहोस्</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </article>

            {/* Story 2 */}
            <article className="group rounded-3xl border bg-card/90 backdrop-blur-xl overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.06)] hover:shadow-[0_22px_55px_rgba(0,0,0,0.13)] hover:-translate-y-2 transition-all duration-300 flex flex-col justify-between">
              <div className="p-8 sm:p-10 space-y-5">
                <Badge
                  variant="secondary"
                  className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 font-bold text-xs px-3 py-1 rounded-full"
                >
                  वकालत · नयाँ कथा
                </Badge>
                <h3 className="text-2xl sm:text-3xl font-black text-foreground leading-tight group-hover:text-primary transition-colors">
                  युवा सरोकार: नयाँ पुस्ताको स्वर
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed">
                  शिक्षा, रोजगारी र मानसिक स्वास्थ्य र मनोरञ्जनका विषय प्रायः उपेक्षित रहन्छन्। हामीले युवा स्वयंले स्थानीय नेतृत्वसँग संवाद गर्ने मञ्च निर्माण गरेका छौं।
                </p>
              </div>
              <div className="px-8 sm:px-10 pb-8 pt-3 border-t">
                <a
                  href="https://hyc.com.np/stories/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-extrabold text-primary hover:underline underline-offset-4"
                >
                  <span>सबै कथा हेर्नुहोस्</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </a>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ────────────────── 3D PARTICIPATION & FINAL CTA ────────────────── */}
      <section className="py-24 sm:py-32 border-b bg-gradient-to-b from-background to-muted/40 relative">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-9">
          <div className="space-y-4">
            <span className="text-xs font-black uppercase tracking-widest text-primary">
              तपाईंको सहभागिता कस्तो होला?
            </span>
            <div className="inline-block mx-auto rounded-full bg-primary/10 border border-primary/20 px-5 py-2 text-sm font-bold text-primary shadow-xs">
              सदस्यता: क्लबको सदस्य बनी अभियान, तालिम र संवादमा सक्रिय सहभागी हुनुहोस्।
            </div>
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-foreground tracking-tight leading-tight">
              तपाईंको स्वरले परिवर्तनको सूत्रपात गर्न सक्छ।
            </h2>
            <p className="text-base sm:text-xl text-muted-foreground leading-relaxed font-medium">
              आजैबाट सहभागी बनौं, किनकि भोलिको समाज हामी सबैको साझा उत्तरदायित्व हो।
            </p>
          </div>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="rounded-2xl px-9 h-14 text-base font-black shadow-[0_8px_24px_rgba(0,0,0,0.18)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.25)] hover:-translate-y-1 active:translate-y-0.5 border-b-4 border-black/30 transition-all"
            >
              <a
                href="https://staff.hyc.com.np"
                target="_blank"
                rel="noopener noreferrer"
              >
                सदस्यताका लागि आवेदन दिनुहोस्
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-2xl px-9 h-14 text-base font-bold bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <a
                href="https://hyc.com.np/contact/"
                target="_blank"
                rel="noopener noreferrer"
              >
                सम्पर्क गर्नुहोस्
              </a>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="rounded-2xl px-7 h-14 text-base font-bold text-primary hover:bg-primary/10"
            >
              <Link to="/">
                <ShieldCheck className="h-4 w-4 mr-2" />
                प्रशासनिक पोर्टल
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ────────────────── 3D FOOTER ────────────────── */}
      <footer className="bg-card text-card-foreground border-t py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 border-b pb-12">
            {/* Brand identity */}
            <div className="space-y-3">
              <div className="flex items-center gap-3.5">
                <img
                  src={appConfig.logo_url || ""}
                  alt="Logo"
                  onError={(e) => {
                    (e.target as HTMLImageElement).removeAttribute("src");
                  }}
                  className="size-11 object-contain rounded-xl p-1 bg-card border shadow-xs"
                />
                <span className="text-2xl font-black tracking-tight text-foreground">
                  {appConfig.entity_name}
                </span>
              </div>
              <p className="text-sm font-bold text-primary">
                युवा सोच, सशक्त राष्ट्र!
              </p>
              <p className="text-xs text-muted-foreground font-medium">
                {appConfig.address}
              </p>
            </div>

            {/* Footer Navigation Links */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm font-bold text-muted-foreground">
              <a
                href="https://hyc.com.np/"
                className="hover:text-primary transition-colors"
              >
                गृहपृष्ठ
              </a>
              <a
                href="https://hyc.com.np/about/"
                className="hover:text-primary transition-colors"
              >
                हाम्रोबारे
              </a>
              <a
                href="https://hyc.com.np/our-work/"
                className="hover:text-primary transition-colors"
              >
                हाम्रो काम
              </a>
              <a
                href="https://hyc.com.np/stories/"
                className="hover:text-primary transition-colors"
              >
                कथाहरू
              </a>
              <a
                href="https://hyc.com.np/contact/"
                className="hover:text-primary transition-colors"
              >
                सम्पर्क
              </a>
              {/* Prasanik Portal Link in Footer */}
              <Link
                to="/"
                className="text-primary hover:underline underline-offset-4 font-black flex items-center gap-1.5"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>प्रशासनिक पोर्टल</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground font-medium">
            <p>{appConfig.entity_name ? `© २०२६ ${appConfig.entity_name}. सर्वाधिकार सुरक्षित।` : "© २०२६। सर्वाधिकार सुरक्षित।"}</p>
            <p className="flex items-center gap-2">
              <span>{appConfig.address}</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
