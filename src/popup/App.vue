<template>
	<div class="app-popup">
		<div class="row align-items-center">
			<div class="col">
				<h1 class="mt-3 mb-4 ms-2">
					<a v-if="domainRoot" :href="`https://dmns.app/domains/${domainRoot || domain}`" class="text-dark" target="_blank">
						<span class="text-muted">{{ domain.replace(domainRoot, '') }}</span>{{ domainRoot }}
					</a>
					<a v-else :href="`https://dmns.app/domains/${domainRoot || domain}`" class="text-dark" target="_blank">{{ domain }}</a>
				</h1>
			</div>
			<div class="col-auto">
				<a :href="`https://dmns.app/domains/${domainRoot || domain}?monitor=yesplease`" class="btn btn-sm btn-primary" target="dmns.app">📸 Monitor domain</a>
			</div>
		</div>

		<div v-if="valid">
			<ul class="nav nav-tabs sticky-top mb-2">
				<li v-for="(tab, index) in tabs" :key="index" class="nav-item">
					<span class="nav-link text-center cursor-pointer" :class="{ active: index === tabActive, error: tab.status === 'error' }" @click="tabActive = index">
						<strong>{{ tab.title }}</strong>
						<br />
						<small :class="{'text-info': tab.title === 'History' && data.history.length}">{{ tab.subtitle || '..' }}</small>
					</span>
				</li>
			</ul>

			<div v-for="(tab, index) in tabs" v-bind:key="tab.title" v-if="index === tabActive" class="py-2">
				<div v-if="tab.status === 'loaded'">
					<div v-if="tab.title === 'NS'" class="bg-secondary-lighter rounded p-2 mb-3">
						<table class="table table-sm table-hover mb-0">
							<thead>
								<tr>
									<th>Name server</th>
									<th>SOA Serial</th>
									<th>IP</th>
									<th>Response Time</th>
									<th>ISP</th>
								</tr>
							</thead>
							<tbody>
								<tr v-for="ns in data.ns" class="on-parent">
									<td>{{ ns.ns }}</td>
									<td>{{ ns.soaSerial }}</td>
									<td>
										<p v-for="ip in [ ...ns.IPv4, ...ns.IPv6 ]" class="mb-1">{{ ip }} <span class="show-on-hover btn btn-sm py-0 px-1" @click="copyToClipboard(ip)" title="Copy to clipboard">✂️</span></p>
									</td>
									<td>
										<p v-for="time in ns.responseTimev4" class="mb-1">
											<span v-if="time">{{ time }}ms</span>
											<span v-else class="text-muted">couldn't get</span>
										</p>
										<p v-for="time in ns.responseTimev6" class="mb-1">
											<span v-if="time">{{ time }}ms</span>
											<span v-else class="text-muted">couldn't get</span>
										</p>
									</td>
									<td>..</td>
								</tr>
							</tbody>
						</table>
					</div>
					<div v-else-if="tab.title === 'History'" class="mb-3">
						<p class="lead">Notes and changes detected in WHOIS info or DNS Records.</p>
						<p class="mb-4">Want to be notified about changes in real time? <a :href="`https://dmns.app/domains/${domainRoot || domain}?monitor=yesplease`" target="_blank" class="btn btn-sm btn-primary">📸 Monitor domain</a></p>

						<div class="bg-light rounded p-2">
							<table class="table mb-0">
								<thead>
									<tr>
										<th class="px-2">When</th>
										<th class="px-2">Changes</th>
									</tr>
								</thead>
								<tbody>
									<tr v-for="activity in data.history" :key="activity.id">
										<td class="px-2">
											<p class="mb-2">{{ formatDate(activity.created_at) }}</p>
											<p class="mb-2">{{ new Date(activity.created_at).toLocaleTimeString() }}</p>
											<p class="mb-2"><span class="badge badge-light-secondary">WHOIS change</span></p>
										</td>
										<td class="px-2">
											<div v-if="activity.type === 'whois'">
												<div v-for="text in activity.inText" class="alert alert-info mb-3 py-1 px-2">
													<small class="text-muted me-1">ℹ️</small> {{ text }}
												</div>

												<div class="mb-1" v-for="(item, index) in activity.data" :key="index">
													<div v-if="item.kind === 'E'">
														<p class="bg-diff-line-deleted px-2 mb-0">
															{{ item.path.slice(1).join(', ') }}: <span class="bg-diff-deleted px-1">{{ item.lhs }}</span>
														</p>
														<p class="bg-diff-line-new px-2 mb-2">
															{{ item.path.slice(1).join(', ') }}: <span class="bg-diff-new px-1">{{ item.rhs }}</span>
														</p>
													</div>

													<p v-else-if="item.kind === 'D'" class="bg-diff-line-deleted px-2 mb-2">{{ item.path.slice(1).join(', ') }}: {{ item.lhs }}</p>
													<p v-else-if="item.kind === 'A' && item.item.kind === 'D'" class="bg-diff-line-deleted px-2 mb-2">
														{{ item.path.slice(1).join(', ') }}, {{ item.index }}: {{ item.item.lhs }}
													</p>

													<p v-else-if="item.kind === 'N'" class="bg-diff-line-new px-2 mb-2">{{ item.path.slice(1).join(', ') }}: {{ item.rhs }}</p>
													<p v-else-if="item.kind === 'A' && item.item.kind === 'N'" class="bg-diff-line-new px-2 mb-2">
														{{ item.path.slice(1).join(', ') }}, {{ item.index }}: {{ item.item.rhs }}
													</p>

													<span v-else>{{ item }}</span>
												</div>
											</div>
											<div v-else>
												<p><span class="badge badge-light-secondary text-capitalize">{{ activity.type }}</span></p>
												<p class="mb-2">{{ activity.data }}</p>
											</div>
										</td>
									</tr>
									<tr v-if="!data.history.length">
										<td colspan="2">
											<p class="text-center text-muted mb-0">No changes detected yet 😕</p>
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
					<div v-else-if="tab.title === 'DNS'" class="mb-3">
						<p class="lead">DNS Records retrieved from <span class="badge bg-info-lighter text-info">{{ data.domain.ns[0] }}</span> Name Server.</p>
						<p class="mb-4">Want to be notified when a subdomain is added or modified? <a :href="`https://dmns.app/domains/${domainRoot || domain}?monitor=yesplease`" target="_blank" class="btn btn-sm btn-primary">📸 Monitor domain</a></p>

						<div class="bg-secondary-lighter rounded p-2">
							<table class="table table-sm table-hover mb-0">
								<thead>
									<tr>
										<th>Type</th>
										<th>Name</th>
										<th>TTL</th>
										<th>Content</th>
									</tr>
								</thead>
								<tbody v-for="(group, type) in data.dns">
									<tr v-for="dns in group" class="on-parent">
										<td>
											<span
												class="badge"
												:class="{
													'bg-secondary-light text-secondary': ['NS', 'SOA'].includes(dns.type),
													'bg-success-lighter text-success': ['A', 'AAAA', 'CNAME'].includes(dns.type),
													'bg-info-lighter text-info': ['MX', 'TXT'].includes(dns.type),
													'bg-primary-lighter text-primary': !['NS', 'SOA', 'A', 'AAAA', 'CNAME', 'MX', 'TXT'].includes(dns.type),
												}"
												>{{ dns.type }}</span
											>
										</td>
										<td>
											<span :class="{ 'badge bg-warning-lighter text-warning': isWildcardSubdomain(dns.name) }">
												<a v-if="['A', 'AAAA', 'CNAME'].includes(type) && !isWildcardSubdomain(dns.name)" :href="`http://${dns.name}`" target="_blank">{{ dns.name }}</a>
												<span v-else>{{ dns.name }}</span>
												<span class="show-on-hover btn btn-sm py-0 px-1" @click="copyToClipboard(dns.name)" title="Copy to clipboard">✂️</span>
											</span>
										</td>
										<td>
											<span class="ttl">{{ toTime(dns.ttl) }}</span>
										</td>
										<td>
											<p v-for="value in dns.value" class="mb-1">{{ value }} <span class="show-on-hover btn btn-sm py-0 px-1" @click="copyToClipboard(value)" title="Copy to clipboard">✂️</span></p>
										</td>
									</tr>
									<tr v-if="!group.length">
										<td>
											<span class="badge whitebg text-secondary">{{ type }}</span>
										</td>
										<td colspan="3" class="text-muted">No {{ type }} records</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
					<div v-else-if="tab.title === 'WHOIS'">
						<p class="mb-2">
							This info was returned by {{ tab.whoisType }} WHOIS server <span class="badge bg-info-lighter text-info">{{ tab.subtitle }}</span>.
						</p>
						<p class="mb-3">
							Want to be notified when anything in WHOIS info changes? <a :href="`https://dmns.app/domains/${domainRoot || domain}?monitor=yesplease`" target="_blank" class="btn btn-sm btn-primary">📸 Monitor domain</a>
						</p>

						<div v-for="group in whoisGroup" class="bg-secondary-lighter rounded p-2 mb-3">
							<h4>{{ group.title }}</h4>

							<table class="table table-hover mb-0">
								<tbody>
									<tr v-for="(content, label) in tab.content" :key="label" v-if="group.fields.includes(label)" class="on-parent">
										<th>{{ label }}</th>
										<td>
											<div v-if="typeof content === 'string'">{{ content }} <span class="show-on-hover btn btn-sm py-0 px-1" @click="copyToClipboard(content)" title="Copy to clipboard">✂️</span></div>
											<div v-else>
												<p class="mb-1" v-for="contentItem in content">{{ contentItem }} <span class="show-on-hover btn btn-sm py-0 px-1" @click="copyToClipboard(contentItem)" title="Copy to clipboard">✂️</span></p>
											</div>
										</td>
									</tr>
								</tbody>
							</table>
						</div>

						<div class="bg-secondary-lighter rounded p-2 mb-3">
							<h4>Other WHOIS info</h4>

							<table class="table table-hover mb-0">
								<tbody>
									<tr v-for="(content, label) in tab.content" :key="label" v-show="!whoisGroupFields.includes(label)">
										<th>{{ label }}</th>
										<td>
											<div v-if="typeof content === 'string'">{{ content }}</div>
											<div v-else>
												<p class="mb-1" v-for="(contentItem, index) in content" :key="index">{{ contentItem }}</p>
											</div>
										</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
					<div v-else-if="tab.title === 'Overview'" class="box">
						<div class="row mb-4">
							<div class="col-auto text-center">
								<h4 class="text-capitalize rounded px-2 py-1 mb-1" :class="[badgeAvailability[tab.content.availability]]">{{ tab.content.availability }}</h4>
								<span v-if="tab.content.availability === 'registered' && tab.content.registrar.name" class="text-muted">
									at
									<a target="_blank" :href="tab.content.registrar.url">{{ truncateText(tab.content.registrar.name, 20) }}</a>
								</span>
							</div>
							<div class="col">
								<span v-for="status in tab.content.status" class="badge bg-secondary-lighter text-secondary m-1">{{ status }}</span>
							</div>
						</div>

						<div v-if="tab.content.availability === 'registered'" class="bg-secondary-lighter rounded p-3 mb-4 position-relative">
							<h6 class="subtitle position-absolute bg-secondary-lighter rounded d-inline-block py-1 px-2 text-muted ms-2" style="top: -12px"><small>Important dates</small></h6>

							<div class="row align-items-center text-center">
								<div class="col">
									<p class="mb-2 lead">
										<strong v-if="tab.content.dates.created">{{ formatDate(tab.content.dates.created) }}</strong>
										<i v-if="!tab.content.dates.created" class="text-muted"><small>unknown</small></i>
									</p>
									<p class="text-uppercase text-muted mb-0">Created {{ formatDistanceToNowStrict(new Date(tab.content.dates.created), { addSuffix: true }) }}</p>
								</div>
								<div class="col">
									<p class="mb-2 lead">
										<strong v-if="tab.content.dates.updated">{{ formatDate(tab.content.dates.updated) }}</strong>
										<i v-if="!tab.content.dates.updated" class="text-muted"><small>unknown</small></i>
									</p>
									<p class="text-uppercase text-muted mb-0">Updated</p>
								</div>
								<div class="col">
									<p class="mb-2 lead">
										<strong v-if="tab.content.dates.expiry">{{ formatDate(tab.content.dates.expiry) }}</strong>
										<i v-if="!tab.content.dates.expiry" class="text-muted"><small>unknown</small></i>
									</p>
									<p v-if="tab.content.dates.expiry && tab.content.dates.expiryDays >= 0" class="text-uppercase text-muted mb-0">
										Expires {{ formatDistanceToNowStrict(new Date(tab.content.dates.expiry), { addSuffix: true }) }}
									</p>
									<p v-else-if="tab.content.dates.expiry && tab.content.dates.expiryDays < 0" class="text-uppercase text-muted mb-0">
										<span class="badge badge-warning">Expired {{ formatDistanceToNowStrict(new Date(tab.content.dates.expiry), { addSuffix: true }) }}</span>
									</p>
									<p v-else class="text-uppercase text-muted mb-0">Expires</p>
								</div>
							</div>
						</div>

						<div v-if="tab.content.availability === 'registered'" class="bg-secondary-lighter rounded mb-3 position-relative">
							<h6 class="subtitle position-absolute bg-secondary-lighter rounded d-inline-block py-1 px-2 text-muted ms-2" style="top: -12px"><small>Domain owner</small></h6>

							<div class="row align-items-center">
								<div class="col-auto py-3">
									<img
										:src="getPicture(tab.content.registrant.email || '')"
										@error="$event.target.src = 'https://files.layered.market/neutral-2.png'"
										width="50"
										class="rounded ms-3"
										alt="Registrant"
									/>
								</div>
								<div class="col py-2">
									<p class="mb-1 lead" v-html="uniqueValues([tab.content.registrant.name, tab.content.registrant.organization], 'Anonymous')"></p>
									<p class="mb-1" v-html="'📍 ' + uniqueValues([tab.content.registrant.city, tab.content.registrant.stateOrProvince, tab.content.registrant.country], 'No location found')"></p>
									<p class="mb-0 text-break" v-html="'💬 ' + uniqueValues([tab.content.registrant.phone, tab.content.registrant.email], 'No contact info found')"></p>
								</div>
								<div v-if="(tab.content.registrant.city || tab.content.registrant.stateOrProvince || tab.content.registrant.country)" class="col-auto">
									<img :src="`https://maps.googleapis.com/maps/api/staticmap?center=${[tab.content.registrant.city, tab.content.registrant.stateOrProvince, tab.content.registrant.postalCode, tab.content.registrant.country].filter(Boolean).join(', ')}&zoom=${[tab.content.registrant.city, tab.content.registrant.stateOrProvince, tab.content.registrant.country].filter(Boolean).length * 3 - 1}&size=205x115&key=AIzaSyCsteGqYhVM141VSrVKoNpA17G51g-HF8o&region=${tab.content.registrant.country}`" alt="Registrant location" class="rounded-end" />
								</div>
							</div>
						</div>

						<div v-if="tab.content.availability === 'registered' && !tab.content.status.includes('inactive')" class="bg-secondary-lighter rounded p-2 mb-3">
							<div class="row my-2">
								<div class="col-3">
									<span class="subtitle text-muted">Name Servers</span>
								</div>
								<div class="col">
									<span v-for="ns in (tab.content.ns.length > 5 ? tab.content.ns.slice(0, 4) : tab.content.ns)" class="badge bg-info-lighter text-info text-lowercase me-1 mb-1">{{ ns }}</span>
									<small v-if="tab.content.ns.length > 5" class="text-primary cursor-pointer" @click="tabActive = tabs.length - 3">and {{ tab.content.ns.length - 4 }} more</small>
								</div>
							</div>

							<div class="row my-2">
								<div class="col-3">
									<span class="subtitle text-muted">DNS Records</span>
								</div>
								<div v-if="data.dns" class="col">
									<span v-for="dns in (Object.values(data.dns).flat().length > 6 ? [...data.dns.A, ...data.dns.CNAME].slice(0, 5) : [...data.dns.A, ...data.dns.CNAME])" class="badge bg-secondary-light text-secondary text-lowercase me-1 mb-1">{{ dns.name }}</span>
									<small v-if="Object.values(data.dns).flat().length > 6" class="text-primary cursor-pointer" @click="tabActive = tabs.length - 2">and {{ Object.values(data.dns).flat().length - 5 }} more</small>
								</div>
								<div class="col" v-else>
									..
								</div>
							</div>

							<div class="row gx-2">
								<div v-if="tab.content.registrar.url" class="col-2 my-1">
									<a :href="tab.content.registrar.url" class="bg-primary-lighter rounded py-2 d-block text-center" target="_blank">
										<p class="subtitle text-muted mb-2">Registrar</p>
										<p class="mb-1"><img :src="`https://logo.clearbit.com/${getHostname(tab.content.registrar.url)}`" width="50" class="rounded" alt="Registrar" /></p>
										<p class="mb-0">{{ tab.content.registrar.name }}</p>
									</a>
								</div>

								<div v-for="dnsProvider in tab.content.services.dns" :key="dnsProvider.name" class="col-2 my-1">
									<a :href="dnsProvider.url" class="bg-primary-lighter rounded py-2 d-block text-center" target="_blank">
										<p class="subtitle text-muted mb-2">DNS Provider</p>
										<p class="mb-1"><img :src="dnsProvider.logo" width="50" class="rounded" alt="DNS provider" /></p>
										<p class="mb-0">{{ dnsProvider.name }}</p>
									</a>
								</div>

								<div v-if="data.emailProvider" class="col-2 my-1">
									<a :href="data.emailProvider.url" class="bg-primary-lighter rounded py-2 d-block text-center" target="_blank">
										<p class="subtitle text-muted mb-2">Inbound email</p>
										<p class="mb-1"><img :src="data.emailProvider.logo" width="50" class="rounded" alt="Email provider" /></p>
										<p class="mb-0">{{ data.emailProvider.name }}</p>
									</a>
								</div>

								<div v-for="email in data.services.emailOutbound" :key="`email-out-${email.name}`" class="col-2 my-1">
									<a :href="email.url" class="bg-primary-lighter rounded py-2 d-block text-center" target="_blank">
										<p class="subtitle text-muted mb-2" style="font-size: 80%">Outbound email</p>
										<p class="mb-1"><img :src="email.logo" width="50" class="rounded" alt="DNS provider" /></p>
										<p class="mb-0">{{ email.name }}</p>
									</a>
								</div>
							</div>
						</div>

						<div v-if="tab.content.availability === 'available'" class="bg-secondary-lighter rounded p-3 mb-3">
							<p class="lead">
								<strong>{{ domainRoot || domain }}</strong> is available to register:
							</p>
							<p>
								<a v-for="buy in tab.content.services.buy" :key="buy.name" :href="buy.url" class="btn btn-outline-primary mx-1" target="_blank">{{ buy.name }}</a>
							</p>
						</div>

						<div class="bg-secondary-lighter rounded p-3 mb-3">
							<p class="mb-0">
								Other TLDs for <strong>"{{ data.domain.keyword }}"</strong>
								<a v-for="(status, tld) in tlds" :href="'https://dmns.app/domains/' + data.domain.keyword + '.' + tld" :key="tld" class="btn btn-sm m-1" target="_blank" :class="{ 'btn-outline-success': status === 'available', 'btn-outline-secondary': !['available'].includes(status) }">
									<span v-if="status === 'loading'">.{{ tld }} <div class="spinner-border spinner-border-sm" role="status"></div></span>
									<span v-else><strong>.{{ tld }}</strong> - {{ labelAvailability[status] || status }}</span>
								</a>
							</p>
						</div>
					</div>
					<div v-else class="box">
						<pre>{{ tab.content }}</pre>
					</div>
				</div>
				<div v-else-if="tab.status === 'loading'">
					<div class="d-flex justify-content-center">
						<div class="spinner-border text-primary my-3" role="status"></div>
					</div>
					<loading></loading>
				</div>
				<div v-else-if="tab.status === 'error'" class="alert alert-danger">
					{{ tab.content }}
				</div>
			</div>
		</div>
		<div v-else class="text-center alert alert-warning">Not a valid domain, can't get WHOIS or DNS data</div>
	</div>
</template>

<script>
import md5 from 'blueimp-md5'
import { formatDistanceToNowStrict } from 'date-fns'
import Loading from '../components/Loading.vue'
const apiHost = 'https://domains-api-browser-extension-qoenb5pwba-lz.a.run.app'
console.log = chrome.extension.getBackgroundPage().console.log

export default {
	components: { Loading },
	data() {
		return {
			domain: '-',
			domainRoot: '',
			valid: false,
			tabs: [],
			tabActive: 0,
			tlds: {},
			data: {
				domain: null,
				whois: null,
				ns: null,
				dns: null,
				emailProvider: null,
				services: {
					emailInbound: [],
					emailOutbound: [],
				},
				history: [],
			},
			labelAvailability: {
				registered: 'taken',
			},
			badgeAvailability: {
				available: 'bg-success-lighter text-green-500',
				registered: 'bg-info-lighter text-blue-500',
				reserved: 'bg-secondary-lighter text-secondary',
				unknown: 'bg-warning-lighter text-warning',
			},
			whoisGroup: [
				{
					title: 'Domain Info',
					fields: [
						'Domain Name',
						'Domain Status',
						'Name Server',
						'Domain nameservers',
						'ROID',
						'Registry Domain ID',
						'IDN',
						'Whoisprivacy',
						'Created Date',
						'Updated Date',
						'Expiry Date',
						'free-date',
						'Registration status',
						'DNSSEC',
						'DNSSEC DS Data',
						'Error',
						'ERROR',
					],
				},
				{
					title: 'Registrar',
					fields: [
						'Registrar',
						'Sponsoring Registrar',
						'Record maintained by',
						'Registrar URL',
						'Registrar WHOIS Server',
						'Registry WHOIS Server',
						'Registrar IANA ID',
						'Registrar Abuse Contact Email',
						'Registrar Abuse Contact Phone',
						'Referral URL',
						'Registrar-Reseller Name',
						'Reseller',
						'Reseller URL',
						'Reseller Name',
						'Reseller Email',
						'admin-contact',
						'Abuse Contact',
						'source',
					],
				},
				{
					title: 'Contact - Registrant',
					fields: [
						'Registry Registrant ID',
						'Registrant ID',
						'Registrant Contact ID',
						'Registrant Name',
						'Registrant Organization',
						'Registrant Street',
						'Registrant City',
						'Registrant State/Province',
						'Registrant Postal Code',
						'Registrant Country',
						'Registrant Email',
						'Registrant Phone',
						'Registrant Phone Ext',
						'Registrant Phone Ext.',
						'Registrant Fax',
						'Registrant Fax Ext',
						'Registrant Fax Ext.',
						'Registrant Application Purpose',
						'Registrant Nexus Category',
					],
				},
				{
					title: 'Contact - Admin',
					fields: [
						'Registry Admin ID',
						'Admin Name',
						'Admin Organization',
						'Admin Organisation',
						'Admin Street',
						'Admin City',
						'Admin State/Province',
						'Admin Postal Code',
						'Admin Country',
						'Admin Phone',
						'Admin Email',
						'Admin Phone Ext',
						'Admin Fax',
						'Admin Fax Ext',
						'Admin Phone Ext.',
						'Admin Fax Ext.',
						'Admin Application Purpose',
						'Admin Nexus Category',
					],
				},
				{
					title: 'Contact - Tech',
					fields: [
						'Registry Tech ID',
						'Tech Contact ID',
						'Tech Name',
						'Tech Contact Name',
						'Tech Organization',
						'Tech Organisation',
						'Tech Street',
						'Tech City',
						'Tech State/Province',
						'Tech Postal Code',
						'Tech Country',
						'Tech Phone',
						'Tech Email',
						'Tech Phone Ext',
						'Tech Fax',
						'Tech Fax Ext',
						'Tech Phone Ext.',
						'Tech Fax Ext.',
						'Tech Application Purpose',
						'Tech Nexus Category',
					],
				},
				{
					title: 'Contact - Billing',
					fields: [
						'Registry Billing ID',
						'Billing Name',
						'Billing Organization',
						'Billing Organisation',
						'Billing Street',
						'Billing City',
						'Billing State/Province',
						'Billing Postal Code',
						'Billing Country',
						'Billing Phone',
						'Billing Email',
						'Billing Phone Ext',
						'Billing Fax',
						'Billing Fax Ext',
						'Billing Phone Ext.',
						'Billing Fax Ext.',
					],
				},
			],
		}
	},
	created() {
		const allowedProtocols = ['http:', 'https:', 'ftp:']

		chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
			const url = new URL(tabs[0].url)

			this.domain = url.hostname
			this.valid = allowedProtocols.includes(url.protocol) && url.hostname.includes('.')

			if (this.valid) this.loadInfo()
		})
	},
	computed: {
		whoisGroupFields() {
			return this.whoisGroup.map(g => g.fields).flat()
		},
	},
	methods: {
		formatDistanceToNowStrict,
		loadInfo() {
			const tabOverview = {
				title: 'Overview',
				subtitle: '',
				content: 'Loading..',
				status: 'loading',
			}

			const tabWhois = {
				title: 'WHOIS',
				subtitle: '',
				whoisType: '',
				content: 'loading WHOIS',
				status: 'loading',
			}

			const tabNs = {
				title: 'NS',
				subtitle: '',
				content: 'loading NS',
				status: 'loading',
			}

			const tabDns = {
				title: 'DNS',
				subtitle: '',
				content: 'loading DNS',
				status: 'loading',
			}

			const tabHistory = {
				title: 'History',
				subtitle: '',
				content: 'loading WHOIS & DNS history',
				status: 'loading',
			}

			this.tabs.push(tabOverview, tabWhois, tabNs, tabDns, tabHistory)

			// Get Domain status
			browser.runtime
				.sendMessage({
					action: 'fetch',
					url: `${apiHost}/domain/${this.domain}?detailed=1`,
				})
				.then(re => {
					if (re.error) {
						throw re.error
					}

					// add domain info
					this.domainRoot = re.domain
					this.data.domain = re
					tabOverview.status = 'loaded'
					tabOverview.subtitle = re.availability
					tabOverview.content = re

					// add whois data
					this.data.whois = re.whois
					let i = 0
					Object.keys(this.data.whois).forEach(whoisServer => {
						if (i === 0) {
							tabWhois.status = 'loaded'
							tabWhois.subtitle = whoisServer
							tabWhois.whoisType = 'Registry'
							tabWhois.content = this.data.whois[whoisServer]
						} else {
							this.tabs.splice(i + 1, 0, {
								status: 'loaded',
								title: 'WHOIS',
								subtitle: whoisServer,
								whoisType: 'Registrar',
								content: this.data.whois[whoisServer],
							})
						}

						i++
					})

					this.loadKeywordStatus()
				})
				.catch(err => {
					tabOverview.status = 'error'
					tabOverview.subtitle = 'error'
					tabOverview.content = err

					tabWhois.status = 'error'
					tabWhois.subtitle = 'error'
					tabWhois.content = err
				})

			// Get NS info
			browser.runtime
				.sendMessage({
					action: 'fetch',
					url: `${apiHost}/domain/${this.domain}/name-servers`,
				})
				.then(nsResponse => {
					if (nsResponse.error) {
						throw nsResponse.error
					}

					this.data.ns = nsResponse
					tabNs.status = 'loaded'
					tabNs.subtitle = `${nsResponse.length} found`
					tabNs.content = JSON.stringify(nsResponse, null, 2)
				})
				.catch(err => {
					tabNs.status = 'error'
					tabNs.subtitle = 'error'
					tabNs.content = err
				})

			// Get DNS records
			browser.runtime
				.sendMessage({
					action: 'fetch',
					url: `${apiHost}/domain/${this.domain}/dns-records`,
				})
				.then(dnsResponse => {
					if (dnsResponse.error) {
						throw dnsResponse.error
					}

					const dnsData = {}

					for (const recordType in dnsResponse) {
						dnsData[recordType] = {}

						dnsResponse[recordType].forEach(record => {
							const group = `${record.type}-${record.name}-${record.ttl}`

							if (!dnsData[recordType][group]) {
								dnsData[recordType][group] = {
									name: record.name,
									type: record.type,
									ttl: record.ttl,
									value: [],
								}
							}

							dnsData[recordType][group].value.push(record.value)
						})

						dnsData[recordType] = Object.values(dnsData[recordType])
					}

					this.idTXT(dnsResponse.TXT)

					if (dnsData.MX.length) {
						this.idMX(dnsData.MX[0].value)
					}

					this.data.dns = dnsData
					tabDns.status = 'loaded'
					tabDns.subtitle = `${Object.values(dnsResponse).flat().length} found`
					tabDns.content = JSON.stringify(dnsResponse, null, 2)
				})
				.catch(err => {
					tabDns.status = 'error'
					tabDns.subtitle = 'error'
					tabDns.content = err
				})

			// Get domain History
			browser.runtime
				.sendMessage({
					action: 'fetch',
					url: `${apiHost}/domain/${this.domain}/activity`,
				})
				.then(response => {
					if (response.error) {
						throw response.error
					}

					this.data.history = response
					tabHistory.status = 'loaded'
					tabHistory.subtitle = `${response.length} found`
					tabHistory.content = JSON.stringify(response, null, 2)
				})
				.catch(err => {
					tabHistory.status = 'error'
					tabHistory.subtitle = 'error'
					tabHistory.content = err
				})
		},
		loadKeywordStatus() {
			const tldsToCheck = ['com', 'net', 'co', 'app'].filter(t => t !== this.data.domain.tld)

			tldsToCheck.forEach(tld => {
				this.tlds[tld] = 'loading'
			})

			browser.runtime
				.sendMessage({
					action: 'fetch',
					url: `${apiHost}/keywords/${this.data.domain.keyword}?tlds=${tldsToCheck.join(',')}`,
				})
				.then(tldResponse => {
					if (tldResponse.error) {
						throw tldResponse.error
					}

					for (const tld in tldResponse.byTld) {
						this.tlds[tld] = tldResponse.byTld[tld]
					}

					this.$forceUpdate()
				})
				.catch(err => {
					this.tlds = {}
				})

		},
		uniqueValues(values, defaultValue) {
			if (defaultValue) {
				defaultValue = `<i class="text-muted">${defaultValue}</i>`
			}

			values = [...new Set(values)]

			// remove item that is included in another item, ex "item 1, item 1 plus" => "item 1 plus"
			values = values.filter(item => !values.find(el => el && el !== item && el.includes(item)))

			return values.filter(Boolean).join(', ') || defaultValue
		},
		isWildcardSubdomain(subdomain) {
			return subdomain.startsWith('*.')
		},
		toTime(seconds) {
			let txt = seconds + 's'

			if (seconds >= 86400) {
				const days = Math.round(seconds / 86400)
				txt = days + (days === 1 ? ' day' : ' days')
			} else if (seconds >= 3600) {
				const hours = Math.round(seconds / 3600)
				txt = hours + (hours === 1 ? ' hour' : ' hours')
			} else if (seconds >= 60) {
				const minutes = Math.round(seconds / 60)
				txt = minutes + (minutes === 1 ? ' min' : ' mins')
			}

			return txt
		},
		toJson(data) {
			return JSON.stringify(data, null, 2)
		},
		formatDate(date) {
			date = new Date(date.trim())

			return date.toLocaleDateString()
		},
		getPicture(email) {
			const imgClearbit = `https://logo.clearbit.com/${this.domainRoot || this.domain}?size=50`

			return this.isEmail(email) ? `https://www.gravatar.com/avatar/${md5(email)}?s=50&d=${imgClearbit}` : imgClearbit
		},
		isEmail(email) {
			const emailRegex = /\S+@\S+\.\S+/
			return email && emailRegex.test(email.toLowerCase())
		},
		idTXT(txtRecords) {
			const emails = {
				'_spf.google.com': {
					name: 'Gmail',
					url: 'https://www.google.com/gmail/about/',
					logo: 'https://logo.clearbit.com/google.com',
				},
				'spf.mtasv.net': {
					name: 'Postmark',
					url: 'https://postmarkapp.com/',
					logo: 'https://postmarkapp.com/images/apple-touch-icon.png',
				},
				'helpscoutemail.com': {
					name: 'HelpScout',
					url: 'https://www.helpscout.com/',
					logo: 'https://logo.clearbit.com/helpscout.com',
				},
				'email.freshdesk.com': {
					name: 'Freshdesk',
					url: 'https://freshdesk.com/',
					logo: 'https://freshdesk.com/static-assets/images/favicon/fworks.png',
				},
				'amazonses.com': {
					name: 'Amazon SES',
					url: 'https://aws.amazon.com/ses/',
					logo: 'https://a0.awsstatic.com/libra-css/images/site/touch-icon-iphone-114-smile.png',
				},
				'sendgrid.net': {
					name: 'SendGrid',
					url: 'https://sendgrid.com/',
					logo: 'https://logo.clearbit.com/sendgrid.com',
				},
				'.secureserver.net': {
					name: 'GoDaddy Webmail',
					url: 'https://www.godaddy.com',
					logo: 'https://logo.clearbit.com/godaddy.com',
				},
				'.mcsv.net': {
					name: 'Mailchimp',
					url: 'https://mailchimp.com/',
					logo: 'https://mailchimp.com/release/plums/cxp/images/apple-touch-icon-192.ce8f3e6d.png',
				},
				'.zendesk.com': {
					name: 'Zendesk',
					url: 'https://www.zendesk.com/',
					logo: 'https://d26a57ydsghvgx.cloudfront.net/www/public/assets/images/logos/zendesk114.png',
				},
				'emailsrvr.com': {
					name: 'Rackspace Email',
					url: 'https://www.rackspace.com/email-hosting/webmail',
					logo: 'https://www.rackspace.com/themes/custom/rackspace/favicon.ico',
				},
				'.sailthru.com': {
					name: 'Sailthru',
					url: 'https://www.sailthru.com/product/email/',
					logo: 'https://logo.clearbit.com/sailthru.com',
				},
				'.groovehq.com': {
					name: 'Groove',
					url: 'https://www.groovehq.com/',
					logo: 'https://logo.clearbit.com/groovehq.com',
				},
				'.qualtrics.com': {
					name: 'Qualtrics',
					url: 'https://www.qualtrics.com/',
					logo: 'https://www.qualtrics.com/favicon-32x32.png?v=1',
				},
				'aspmx.pardot.com': {
					name: 'Pardot',
					url: 'https://www.pardot.com/',
					logo: 'https://logo.clearbit.com/pardot.com',
				},
				'.mandrillapp.com': {
					name: 'Mailchimp Mandrill',
					url: 'https://mailchimp.com/features/transactional-email/',
					logo: 'https://mailchimp.com/release/plums/cxp/images/apple-touch-icon-192.ce8f3e6d.png',
				},
				'mailgun.org': {
					name: 'Mailgun',
					url: 'https://www.mailgun.com/',
					logo: 'https://logo.clearbit.com/mailgun.com',
				},
				'mailsenders.netsuite.com': {
					name: 'NetSuite',
					url: 'https://www.netsuite.com/',
					logo: 'https://logo.clearbit.com/netsuite.com',
				},
				'mlsend.com': {
					name: 'MailerLite',
					url: 'https://www.mailerlite.com/',
					logo: 'https://www.mailerlite.com/assets/site/favicons/favicon-32x32.png',
				},
				'sendinblue.com': {
					name: 'Sendinblue',
					url: 'https://www.sendinblue.com/',
					logo: 'https://www.sendinblue.com/wp-content/themes/sendinblue2019/assets/favicon/favicon-32x32.png',
				},
				'.hubspotemail.net': {
					name: 'HubSpot',
					url: 'https://www.hubspot.com/',
					logo: 'https://www.hubspot.com/hubfs/HubSpot_Logos/HubSpot-Inversed-Favicon.png',
				},
			}
			const added = []

			txtRecords.forEach(record => {
				const valueParts = record.value.replace(/\/?\"/g, '').split(' ')

				if (valueParts[0] === 'v=spf1') {
					valueParts.forEach(part => {
						if (part.startsWith('include:')) {
							const spf = part.replace('include:', '')

							for (const spfServer in emails) {
								if (!added.includes(spfServer) && spf.includes(spfServer)) {
									this.data.services.emailOutbound.push(emails[spfServer])
									added.push(spfServer)
								}
							}
						}
					})
				}

				
			})

		},
		idMX(mxRecords) {
			const mxServers = {
				'emailsrvr.com': {
					name: 'Rackspace Email',
					url: 'https://www.rackspace.com/email-hosting/webmail',
					logo: 'https://www.rackspace.com/themes/custom/rackspace/favicon.ico',
				},
				'gmr-smtp-in.l.google.com': {
					name: 'Gmail',
					url: 'https://www.google.com/gmail/about/',
					logo: 'https://logo.clearbit.com/google.com',
				},
				'googlemail.com': {
					name: 'Google G Suite',
					url: 'https://refergsuite.app.goo.gl/1WTE',
					logo: 'https://logo.clearbit.com/google.com',
				},
				'google.com': {
					name: 'Google G Suite',
					url: 'https://refergsuite.app.goo.gl/1WTE',
					logo: 'https://logo.clearbit.com/google.com',
				},
				'outlook.com': {
					name: 'Outlook',
					url: 'https://products.office.com/en/outlook/email-and-calendar-software-microsoft-outlook',
					logo: 'https://logo.clearbit.com/microsoft.com',
				},
				'secureserver.net': {
					name: 'GoDaddy',
					url: 'https://www.godaddy.com/email',
					logo: 'https://img1.wsimg.com/ux/favicon/favicon-96x96.png',
				},
				'pphosted.com': {
					name: 'Proofpoint Email',
					url: 'https://www.proofpoint.com/us/products/email-security-and-protection',
					logo: 'https://www.proofpoint.com/themes/custom/proofpoint/apps/drupal/images/favicons/favicon-120x120.png',
				},
			}

			const added = []

			for (const mxServer in mxServers) {
				mxRecords.forEach(mxRecord => {
					if (!added.includes(mxServer) && mxRecord.toLowerCase().includes(mxServer)) {
						this.data.services.emailInbound.push(mxServers[mxServer])
						added.push(mxServer)
						this.data.emailProvider = mxServers[mxServer]
					}
				})
			}

			return false
		},
		copyToClipboard(str) {
			const el = document.createElement('textarea');
			el.value = str;
			document.body.appendChild(el);
			el.select();
			document.execCommand('copy');
			document.body.removeChild(el);
		}
	},
}
</script>

<style lang="scss" scoped>
@import '../assets/design.scss';

a {
	text-decoration: none;
	color: darkblue;
}

.app-popup {
	height: 500px;
	width: 700px;
	cursor: default;
	font-size: 14px;
	font-family: $font-family-sans-serif;
}

.nav-tabs {
	background: rgba(255, 255, 255, .8);
	backdrop-filter: blur(10px);

	.nav-link {
		padding-left: 0.75rem;
		padding-right: 0.75rem;
		color: $dark;
	}

	.nav-link.error {
		border-color: #f5c6cb;
	}
	.nav-link.active.error {
		border-color: #721c24;
	}
}

.bg-diff-line-new {
	background-color: #e6ffed;
}

.bg-diff-line-deleted {
	background-color: #ffeef0;
}

.bg-diff-new {
	background-color: #acf2bd;
}

.bg-diff-deleted {
	background-color: #fdb8c0;
}

.ttl {
	display: inline-block;
	min-width: 50px;
}
</style>
