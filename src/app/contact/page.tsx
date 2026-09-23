import type { Metadata } from "next";
import {
	MapPin,
	Phone,
	Clock3,
	ArrowRight,
	MessageCircle,
} from "lucide-react";

import Container from "@/components/Container";
import GlassCard from "@/components/ui/GlassCard";
import PrimaryButton from "@/components/ui/PrimaryButton";
import PageHero from "@/components/seo/PageHero";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import ContactForm from "@/components/Visit/ContactForm";

import { contact } from "@/data/contact";
import { site } from "@/data/site";

export const metadata: Metadata = {
	title: "Contact TRIARC EV Hub | Bhadrachalam, Telangana",
	description:
		"Contact TRIARC EV Hub in Bhadrachalam, Telangana for EV charging, charger installation and charging infrastructure enquiries.",
	alternates: {
		canonical: "/contact",
	},
};

export default function ContactPage() {
	// Generate WhatsApp link from the existing phone number.
	// +91 79933 56677 -> https://wa.me/917993356677
	const whatsappLink = `https://wa.me/${contact.phoneHref.replace(/\D/g, "")}`;

	return (
		<main className="bg-[#03110d]">
			<Breadcrumbs
				items={[
					{
						name: "Contact",
						url: "/contact",
					},
				]}
			/>

			<PageHero
				eyebrow="Contact Us"
				title="Contact TRIARC EV Hub"
				description="Reach out to TRIARC EV Hub for questions about EV charging, charger installation, or commercial and fleet charging in Bhadrachalam, Telangana."
			/>

			<section className="relative pb-16 sm:pb-20">
				<Container>
					{/* Equal-height cards on desktop */}
					<div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
						{/* Left: Station information */}
						<GlassCard className="flex h-full flex-col p-6 sm:p-8">
							<div>
								<h2 className="text-xl font-bold text-white">
									{site.station.name}
								</h2>

								<div className="mt-6 space-y-5">
									{/* Address */}
									<div className="flex gap-3">
										<MapPin
											size={19}
											className="mt-0.5 shrink-0 text-emerald-300"
										/>

										<p className="text-sm leading-7 text-white/75 sm:text-base">
											{contact.addressLine1}
											<br />
											{contact.addressLine2}
										</p>
									</div>

									{/* Phone */}
									<div className="flex items-center gap-3">
										<Phone
											size={19}
											className="shrink-0 text-emerald-300"
										/>

										<a
											href={`tel:${contact.phoneHref}`}
											className="text-sm text-white/75 transition hover:text-emerald-200 sm:text-base"
										>
											{contact.phone}
										</a>
									</div>

									{/* WhatsApp */}
									<div className="flex items-center gap-3">
										<MessageCircle
											size={19}
											className="shrink-0 text-emerald-300"
										/>

										<a
											href={whatsappLink}
											target="_blank"
											rel="noopener noreferrer"
											className="text-sm text-white/75 transition hover:text-emerald-200 sm:text-base"
										>
											WhatsApp
										</a>
									</div>

									{/* Hours */}
									<div className="flex items-center gap-3">
										<Clock3
											size={19}
											className="shrink-0 text-emerald-300"
										/>

										<p className="text-sm text-white/75 sm:text-base">
											{contact.hours}
										</p>
									</div>

									{/* Email */}
									{contact.email && (
										<div className="flex items-center gap-3">
											<svg
												width="19"
												height="19"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												strokeWidth="1.8"
												className="shrink-0 text-emerald-300"
												aria-hidden="true"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M4 6h16v12H4z"
												/>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="m4 7 8 6 8-6"
												/>
											</svg>

											<a
												href={`mailto:${contact.email}`}
												className="text-sm text-white/75 transition hover:text-emerald-200 sm:text-base"
											>
												{contact.email}
											</a>
										</div>
									)}
								</div>
							</div>

							{/* Button pushed toward bottom */}
							<div className="mt-auto pt-8">
								<PrimaryButton href={contact.maps}>
									Get Directions
									<ArrowRight size={17} />
								</PrimaryButton>
							</div>
						</GlassCard>

						{/* Right: Contact form */}
						<GlassCard className="flex h-full flex-col p-6 sm:p-8">
							<div>
								<p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
									Contact Us
								</p>

								<h2 className="mt-3 text-3xl font-black leading-tight text-white">
									Drop us a line
								</h2>

								<p className="mt-3 text-sm leading-7 text-white/70">
									Share your EV charging or infrastructure enquiry and our team
									will get back to you.
								</p>
							</div>

							<div className="mt-auto">
								<ContactForm />
							</div>
						</GlassCard>
					</div>
				</Container>
			</section>
		</main>
	);
}