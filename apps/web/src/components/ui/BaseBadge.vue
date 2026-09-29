<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'
    dot?: boolean
    size?: 'default' | 'sm'
  }>(),
  { tone: 'neutral', dot: false, size: 'default' },
)
</script>

<template>
  <span class="ui-badge" :class="[`ui-badge--${tone}`, `ui-badge--${size}`]">
    <span v-if="dot" class="ui-badge__dot" />
    <slot />
  </span>
</template>

<style scoped>
.ui-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border: 1px solid currentColor;
  border-radius: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.6;
  white-space: nowrap;
}

.ui-badge--default {
  padding: 2px 8px;
}

.ui-badge--sm {
  padding: 0px 8px;
}

.ui-badge__dot {
  width: 6px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.ui-badge--neutral {
  color: var(--muted);
}

.ui-badge--ok {
  color: var(--green);
}

.ui-badge--warn {
  color: var(--orange);
}

.ui-badge--danger {
  color: var(--red);
}

.ui-badge--accent {
  color: var(--accent);
}
</style>
