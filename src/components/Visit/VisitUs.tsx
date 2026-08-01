import { Clock3, MapPin, Phone } from "lucide-react";
import Container from "@/components/Container";
import GlassCard from "@/components/ui/GlassCard";
import ContactForm from "@/components/Visit/ContactForm";

const infoItems = [
  { icon: MapPin, title: "Location", value: ["TriArc EV Hub", "Bhadrachalam, Telangana"] },
  { icon: Phone, title: "Contact", value: ["+91 99812 34567", "info@triarcevhub.com"] },
  { icon: Clock3, title: "Hours", value: ["Open 24 × 7", "Fast charging available round the clock"] },
];

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.336 3.608 1.31.975.976 1.248 2.243 1.31 3.61.058 1.265.069 1.645.069 4.847s-.011 3.582-.069 4.847c-.062 1.367-.335 2.634-1.31 3.61-.975.974-2.242 1.248-3.608 1.31-1.266.058-1.646.069-4.85.069s-3.584-.011-4.849-.069c-1.366-.062-2.633-.336-3.608-1.31-.975-.976-1.248-2.243-1.31-3.61C2.175 15.745 2.163 15.365 2.163 12s.012-3.582.07-4.847c.062-1.367.335-2.634 1.31-3.61.975-.974 2.242-1.248 3.608-1.31C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.333.014 7.053.072 5.197.157 3.355.673 1.999 2.029.643 3.385.157 5.227.072 7.083.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.085 1.856.571 3.698 1.927 5.054 1.356 1.355 3.198 1.841 5.054 1.926C8.333 23.986 8.741 24 12 24s3.667-.014 4.947-.072c1.856-.085 3.698-.571 5.054-1.926 1.356-1.356 1.842-3.198 1.927-5.054C23.986 15.668 24 15.259 24 12s-.014-3.667-.072-4.947c-.085-1.856-.571-3.698-1.927-5.054C20.645.643 18.803.157 16.947.072 15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.258 5.63 5.906-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

const socialLinks = [
  { label: "Instagram", href: "https://instagram.com", Icon: InstagramIcon },
  { label: "X", href: "https://x.com", Icon: XIcon },
  { label: "WhatsApp", href: "https://wa.me/919981234567", Icon: WhatsAppIcon },
];

export default function VisitUs() {
  return (
    <section id="contact" className="relative mt-8 overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),#03110d] pb-16 pt-16 sm:mt-10 sm:pb-20 sm:pt-20 lg:mt-12 lg:pb-24 lg:pt-24 xl:pb-28 xl:pt-28">
      <Container>
        <div className="grid gap-6 lg:mt-1 lg:grid-cols-[1fr_1fr] lg:items-stretch lg:gap-7 xl:gap-9">
          <GlassCard className="motion-reveal h-full border-white/10 bg-emerald-950/40 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.22)] sm:p-7 lg:mr-2 lg:p-7">
            <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
              Visit TriArc EV Hub
            </span>
            <h2 className="mt-5 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-[2.45rem]">
              Charge. Relax. Continue your journey.
            </h2>
            <p className="mt-5 text-base leading-8 text-white/80 sm:text-lg">
              Conveniently located in the heart of Bhadrachalam, TriArc EV Hub brings together reliable charging, easy access, and a comfortable pause on the road.
            </p>

            <div className="mt-8 space-y-4">
              {infoItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex gap-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-white/50">{item.title}</h3>
                      <div className="mt-1 space-y-1 text-sm leading-7 text-white/75">
                        {item.value.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-[22px] border border-white/10 bg-white/5 p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Connect with us</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {socialLinks.map(({ label, href, Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-400/35 bg-emerald-500/15 text-emerald-200">
                      <Icon />
                    </span>
                    {label}
                  </a>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="motion-delay-1 h-full border-white/10 bg-[#0a231b]/60 p-5 shadow-[0_24px_65px_rgba(0,0,0,0.24)] sm:p-7 lg:ml-2 lg:p-7">
            <div className="flex h-full flex-col">
              <span className="inline-flex w-fit rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
                Contact Us
              </span>
              <h3 className="mt-5 text-3xl font-black leading-tight text-white sm:text-[2rem]">Drop your Thoughts</h3>
              <p className="mt-3 text-sm leading-7 text-white/75 sm:text-base">
                Share your concerns and our team will get back to you.
              </p>

              <ContactForm />
            </div>
          </GlassCard>
        </div>
      </Container>
    </section>
  );
}