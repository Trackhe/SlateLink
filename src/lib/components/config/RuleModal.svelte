<script lang="ts">
	export let showRuleModal = false;
	export let ruleModalId: number | null = null;

	export let frontends: { name: string }[] = [];
	export let backends: { name: string }[] = [];
	export let crtStores: { name: string }[] = [];
	export let mergedCertOptions: { value: string; label: string }[] = [];

	export let ruleFormFrontend = '';
	export let ruleFormDomains: string[] = [];
	export let ruleFormDomainInput = '';
	export let ruleFormBackend = '';
	export let ruleFormSslCertificate = '';
	export let ruleFormRedirectHttpToHttps = false;
	export let ruleFormError = '';
	export let ruleFormSaving = false;

	export let closeRuleModal: () => void;
	export let saveRule: () => void;
	export let ruleRemoveDomain: (domain: string) => void;
	export let ruleDomainKeydown: (event: KeyboardEvent) => void;
	export let handleOverlayClick: (event: MouseEvent) => void;
	export let handleOverlayKeydown: (event: KeyboardEvent) => void;
</script>

{#if showRuleModal}
	<!-- svelte-ignore a11y-no-static-element-interactions a11y-no-noninteractive-element-interactions a11y-click-events-have-key-events -->
	<div
		data-modal-overlay="true"
		role="dialog"
		aria-modal="true"
		aria-labelledby="rule-modal-title"
		class="modal-overlay open"
		on:click={handleOverlayClick}
		on:keydown={handleOverlayKeydown}
		tabindex="-1"
	>
		<!-- svelte-ignore a11y-no-static-element-interactions a11y-no-noninteractive-element-interactions a11y-click-events-have-key-events -->
		<div
			class="modal"
			style="max-width: 42rem;"
			on:click|stopPropagation
			role="document"
		>
			<div class="p-6">
				<div class="flex items-center justify-between gap-4 mb-4">
					<h2 id="rule-modal-title" class="text-xl font-semibold text-[var(--gh-fg)]">
						{ruleModalId != null ? 'Regel bearbeiten' : 'Regel anlegen'}
					</h2>
					<button
						type="button"
						class="text-[var(--gh-fg-muted)] hover:text-[var(--gh-fg)] p-1"
						on:click={closeRuleModal}
						aria-label="Schließen">✕</button
					>
				</div>
				<form on:submit|preventDefault={saveRule} class="space-y-4">
					<div>
						<label for="rule-frontend" class="block text-sm font-medium text-[var(--gh-fg)] mb-1"
							>Frontend</label
						>
						<select
							id="rule-frontend"
							bind:value={ruleFormFrontend}
							class="w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-3 py-2 text-sm text-[var(--gh-fg)]"
							disabled={ruleModalId != null}
						>
							<option value="">— Frontend wählen —</option>
							{#each frontends ?? [] as frontend}
								<option value={frontend.name}>{frontend.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="rule-domain-input" class="block text-sm font-medium text-[var(--gh-fg)] mb-1"
							>Domains</label
						>
						<div
							class="flex flex-wrap items-center gap-1.5 rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-2 py-1.5 text-sm min-h-[2.5rem]"
						>
							{#each ruleFormDomains as domain}
								<span
									class="inline-flex items-center gap-1 rounded bg-[var(--gh-canvas-subtle)] border border-[var(--gh-border)] text-[var(--gh-fg)] px-2 py-0.5 text-xs"
								>
									{domain}
									<button
										type="button"
										class="rounded hover:bg-black/10 dark:hover:bg-white/10 p-0.5 leading-none"
										on:click={() => ruleRemoveDomain(domain)}
										aria-label="Domain entfernen">×</button
									>
								</span>
							{/each}
							<input
								id="rule-domain-input"
								type="text"
								bind:value={ruleFormDomainInput}
								on:keydown={ruleDomainKeydown}
								placeholder="Domain, Enter"
								class="flex-1 min-w-[120px] bg-transparent border-0 outline-none py-0.5 text-[var(--gh-fg)] placeholder-[var(--gh-fg-muted)]"
							/>
						</div>
					</div>
					<div>
						<label for="rule-backend" class="block text-sm font-medium text-[var(--gh-fg)] mb-1"
							>Backend</label
						>
						<select
							id="rule-backend"
							bind:value={ruleFormBackend}
							class="w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-3 py-2 text-sm text-[var(--gh-fg)]"
						>
							<option value="">— Backend wählen —</option>
							{#each backends ?? [] as backend}
								<option value={backend.name}>{backend.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="rule-cert" class="block text-sm font-medium text-[var(--gh-fg)] mb-1"
							>Zertifikat (optional)</label
						>
						<select
							id="rule-cert"
							bind:value={ruleFormSslCertificate}
							class="w-full rounded border border-[var(--gh-border)] bg-[var(--gh-canvas)] px-3 py-2 text-sm text-[var(--gh-fg)]"
						>
							<option value="">— Keins —</option>
							{#each mergedCertOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
							{#each crtStores ?? [] as store}
								<option value="store:{store.name}">Store: {store.name}</option>
							{/each}
						</select>
					</div>
					<div class="flex items-center gap-2">
						<input
							type="checkbox"
							id="rule-redirect"
							bind:checked={ruleFormRedirectHttpToHttps}
							class="rounded"
						/>
						<label for="rule-redirect" class="text-sm text-[var(--gh-fg)]"
							>HTTP→HTTPS für diese Domain</label
						>
					</div>
					{#if ruleFormError}
						<p class="gh-error">{ruleFormError}</p>
					{/if}
					<div class="modal-actions">
						<button type="button" class="btn btn-secondary" on:click={closeRuleModal}>
							Abbrechen
						</button>
						<button
							type="submit"
							disabled={ruleFormSaving || !ruleFormFrontend.trim() || !ruleFormBackend.trim()}
							class="btn btn-primary"
						>
							{ruleFormSaving ? 'Speichern …' : 'Speichern'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
