<script setup lang="ts">
import { siteCopy } from "../copy/siteCopy";
import { appAssetUrl } from "../utils/assetUrls";

defineProps<{ currentVersion: string | null; latestVersion: string; downloadUrl: string }>();
defineEmits<{ download: [event: MouseEvent]; check: [] }>();
const guideUrl = appAssetUrl("install/gateway/");
</script>

<template>
  <aside class="study-gateway-update" aria-label="全文朗读服务更新" data-testid="gateway-update-notice">
    <p role="status">{{ siteCopy.template.gatewayUpdateAvailable(currentVersion, latestVersion) }}</p>
    <p>{{ siteCopy.template.gatewayUpdateInstructions }}</p>
    <div class="study-gateway-update-actions">
      <a class="study-link" :href="downloadUrl" download @click="$emit('download', $event)">
        {{ siteCopy.template.gatewayUpdateDownload(latestVersion) }}
      </a>
      <a class="study-link" :href="guideUrl" target="_blank" rel="noopener noreferrer">安装说明</a>
      <button type="button" class="study-button" @click="$emit('check')">已安装，重新检测</button>
    </div>
  </aside>
</template>
