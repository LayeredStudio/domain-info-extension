<script>
import { formatDistanceToNow } from 'date-fns'

export default {
	name: 'DateTime',
	props: {
		date: {
			type: Date,
			required: true,
		},
		style: {
			type: String,
			default: 'datetime',
		},
		showTime: {
			type: Boolean,
			default: true,
		},
	},
	methods: {
		formatDistanceToNow,
	},
}
</script>

<template>
	<span v-if="style === 'datetime'" :title="formatDistanceToNow(date, { addSuffix: true })">
		{{ date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: showTime ? 'short' : undefined }) }}
	</span>
	<span v-else :title="date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: showTime ? 'short' : undefined })">
		{{ formatDistanceToNow(date, { addSuffix: true }) }}
	</span>
</template>
