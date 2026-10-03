<script setup lang="ts">
import BaseButton from './BaseButton.vue'
import BaseIcon from './BaseIcon.vue'
import type { IconName } from './icons'

withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: IconName
    tone?: 'neutral' | 'danger'
    actionLabel?: string
  }>(),
  { tone: 'neutral' },
)

defineEmits<{ action: [] }>()
</script>

<template>
  <div class="ui-state" :class="`ui-state--${tone}`" :role="tone === 'danger' ? 'alert' : 'status'">
    <BaseIcon v-if="icon" :name="icon" :size="22" class="ui-state__icon" />
    <p class="ui-state__title">{{ title }}</p>
    <p v-if="description" class="ui-state__desc">{{ description }}</p>
    <BaseButton v-if="actionLabel" variant="ghost" size="sm" @click="$emit('action')">
      {{ actionLabel }}
    </BaseButton>
  </div>
</template>

<style scoped>
.ui-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 22px 16px;
  text-align: center;
  color: var(--muted);
}

.ui-state__icon {
  color: var(--muted);
}

.ui-state--danger .ui-state__icon,
.ui-state--danger .ui-state__title {
  color: var(--red);
}

.ui-state__title {
  margin: 0;
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 600;
}

.ui-state__desc {
  margin: 0;
  font-size: 0.75rem;
  max-width: 44ch;
}
</style>
