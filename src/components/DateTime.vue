<script>
import { formatDistanceToNow } from 'date-fns'

export default {
	name: 'DateTime',
	props: {
		date: {
			type: Date,
			required: true
		},
		style: {
			type: String,
			default: 'datetime'
		}
	},
	methods: {
		formatDistanceToNow,
	},
}
</script>

<template>
	<span v-if="style === 'datetime'" :title="formatDistanceToNow(date, { addSuffix: true })">
		{{ date.toLocaleString('default', { dateStyle: 'medium', timeStyle: 'short' }) }}
	</span>
	<span v-else :title="date.toLocaleString('default', { dateStyle: 'medium', timeStyle: 'short' })">
		{{ formatDistanceToNow(date, { addSuffix: true }) }}
	</span>
</template>
