import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2, MapPin, ArrowRight } from "lucide-react";

import Container from "@/components/Container";
import PrimaryButton from "@/components/ui/PrimaryButton";
import Breadcrumbs from "@/components/seo/Breadcrumbs";
import { contact } from "@/data/contact";

export const metadata: Metadata = {
	title: "About TRIARC EV Hub",
	description:
		"Learn about TRIARC EV Hub, an EV charging station in Bhadrachalam, Telangana, open 24 × 7 with convenient parking and Wi-Fi.",
	alternates: {
		canonical: "/about",
	},
};

const highlights = [
	"EV charging in Bhadrachalam, Telangana",
	"Open 24 × 7",
	"Convenient Park Road location",
	"Wi-Fi available",
	"Parking available",
];

export default function AboutPage() {
	return (
		<main className="bg-[#03110d]">
			{/* Breadcrumb */}
			<Breadcrumbs
				items={[
					{
						name: "About",
						url: "/about",
					},
				]}
			/>

			{/* About Header */}
			<section className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.14),_transparent_35%),#03110d] pb-12 pt-8 sm:pb-16 sm:pt-10">
				<Container>
					<div className="mx-auto max-w-3xl text-center">
						<span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
							About Us
						</span>

						<h1 className="mt-6 text-[clamp(2.2rem,4vw,3.6rem)] font-black leading-tight text-white">
							About TRIARC EV Hub
						</h1>

						<p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/70 sm:text-lg">
							TRIARC EV Hub is an EV charging destination in Bhadrachalam,
							Telangana, making EV charging simple and convenient for every
							journey.
						</p>
					</div>
				</Container>
			</section>

			{/* Main About Content */}
			<section className="relative overflow-hidden bg-[#03110d] pb-16 pt-4 sm:pb-20 sm:pt-8">
				<Container>
					<div className="grid items-center gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16 xl:gap-20">
						{/* Image */}
						<div className="relative mx-auto w-full max-w-[680px] overflow-hidden rounded-[30px] border border-white/10 bg-white/5">
							<Image
								src="/images/stations/experience.png"
								alt="TRIARC EV Hub charging station in Bhadrachalam"
								width={1400}
								height={900}
								sizes="(max-width: 1024px) 100vw, 50vw"
								className="h-[320px] w-full object-cover sm:h-[400px] lg:h-[450px]"
							/>
						</div>

						{/* Content */}
						<div className="mx-auto w-full max-w-2xl">
							<h2 className="text-3xl font-black leading-tight text-white sm:text-4xl lg:text-[2.7rem]">
								Charging made simple.
								<br />
								<span className="text-emerald-400">
									Your journey continues.
								</span>
							</h2>

							<p className="mt-5 max-w-xl text-base leading-8 text-white/70 sm:text-lg">
								Located on Park Road, next to Kakatiya Residency in
								Bhadrachalam, TRIARC EV Hub provides a convenient place for EV
								owners to charge, pause and continue their journey.
							</p>

							<div className="mt-7 grid gap-4 sm:grid-cols-2">
								{highlights.map((item) => (
									<div
										key={item}
										className="flex items-center gap-3"
									>
										<CheckCircle2
											size={21}
											strokeWidth={2.2}
											className="shrink-0 text-emerald-400"
										/>

										<span className="text-sm font-medium text-white/80 sm:text-base">
											{item}
										</span>
									</div>
								))}
							</div>
						</div>
					</div>
				</Container>
			</section>
		</main>
	);
}