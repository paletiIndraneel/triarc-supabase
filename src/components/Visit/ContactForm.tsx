"use client";

import { useState } from "react";

interface FormState {
	name: string;
	email: string;
	phone: string;
	message: string;
}

const EMPTY: FormState = {
	name: "",
	email: "",
	phone: "",
	message: "",
};

export default function ContactForm() {
	const [form, setForm] = useState<FormState>(EMPTY);
	const [status, setStatus] = useState<
		"idle" | "loading" | "success" | "error"
	>("idle");
	const [errorMsg, setErrorMsg] = useState("");

	function handleChange(
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
	) {
		const { name, value } = e.target;

		setForm((prev) => ({
			...prev,
			[name]: value,
		}));
	}

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();

		setStatus("loading");
		setErrorMsg("");

		try {
			const res = await fetch("/api/contact", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(form),
			});

			const data = await res.json();

			if (!res.ok) {
				setErrorMsg(data.error ?? "Something went wrong.");
				setStatus("error");
				return;
			}

			setStatus("success");
			setForm(EMPTY);
		} catch {
			setErrorMsg("Network error. Please try again.");
			setStatus("error");
		}
	}

	if (status === "success") {
		return (
			<div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
				<div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth={2.2}
						className="h-7 w-7"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M5 13l4 4L19 7"
						/>
					</svg>
				</div>

				<h3 className="text-xl font-bold text-white">
					Message Sent!
				</h3>

				<p className="max-w-xs text-sm leading-7 text-white/70">
					Thanks for reaching out. Our team will get back to you shortly.
				</p>

				<button
					type="button"
					onClick={() => setStatus("idle")}
					className="mt-2 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/5"
				>
					Send another message
				</button>
			</div>
		);
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="mt-6 grid gap-4"
			noValidate
		>
			{/* Name + Email */}
			<div className="grid gap-4 sm:grid-cols-2">
				<label className="grid gap-1.5 text-sm font-medium text-white/85">
					<span>Name</span>

					<input
						type="text"
						name="name"
						value={form.name}
						onChange={handleChange}
						placeholder="Your name"
						required
						autoComplete="name"
						className="h-11 w-full rounded-lg border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-emerald-400/70 focus:bg-white/10"
					/>
				</label>

				<label className="grid gap-1.5 text-sm font-medium text-white/85">
					<span>Email</span>

					<input
						type="email"
						name="email"
						value={form.email}
						onChange={handleChange}
						placeholder="you@example.com"
						required
						autoComplete="email"
						className="h-11 w-full rounded-lg border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-emerald-400/70 focus:bg-white/10"
					/>
				</label>
			</div>

			{/* Message */}
			<label className="grid gap-1.5 text-sm font-medium text-white/85">
				<span>Message</span>

				<textarea
					name="message"
					value={form.message}
					onChange={handleChange}
					rows={4}
					placeholder="Tell us your travel or charging plan..."
					required
					className="min-h-[108px] resize-none rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-emerald-400/70 focus:bg-white/10"
				/>
			</label>

			{/* Error */}
			{status === "error" && (
				<p className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
					{errorMsg}
				</p>
			)}

			{/* Submit */}
			<button
				type="submit"
				disabled={status === "loading"}
				className="mt-1 inline-flex w-fit items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{status === "loading" && (
					<svg
						className="h-4 w-4 animate-spin"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth={2.5}
					>
						<path
							strokeLinecap="round"
							d="M12 2a10 10 0 0 1 10 10"
						/>
					</svg>
				)}

				{status === "loading" ? "Sending…" : "Send Message"}
			</button>
		</form>
	);
}