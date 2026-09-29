<script setup lang="ts">
import { computed } from 'vue'
import { ICONS, type IconName } from './icons'

const props = withDefaults(defineProps<{ name: IconName; size?: number | string }>(), {
  size: '1em',
})

const icon = computed(() => ICONS[props.name])
</script>

<template>
  <svg
    class="base-icon"
    :viewBox="icon.viewBox"
    :width="size"
    :height="size"
    :fill="icon.mode === 'fill' ? 'currentColor' : 'none'"
    :stroke="icon.mode === 'stroke' ? 'currentColor' : undefined"
    :stroke-width="icon.mode === 'stroke' ? icon.strokeWidth : undefined"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
    v-html="icon.path"
  />
</template>

<style scoped>
.base-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: -0.125em;
}
</style>
