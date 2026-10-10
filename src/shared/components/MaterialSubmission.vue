<script setup lang="ts">
import { ref, useId } from "vue";
import { appAssetUrl } from "../utils/assetUrls";

defineProps<{ emailImageUrl: string }>();

const dialog = ref<HTMLDialogElement | null>(null);
const trigger = ref<HTMLAnchorElement | null>(null);
const suggestionDialog = ref<HTMLDialogElement | null>(null);
const suggestionTrigger = ref<HTMLAnchorElement | null>(null);
const titleId = useId();
const descriptionId = useId();
const suggestionTitleId = useId();
const wechatImageUrl = appAssetUrl("wechat.png");
let backdropPointerDown = false;

function isOutsideDialog(event: MouseEvent): boolean {
  if (!(event.target instanceof HTMLDialogElement)) return false;
  const bounds = event.target.getBoundingClientRect();
  return event.clientX < bounds.left || event.clientX > bounds.right
    || event.clientY < bounds.top || event.clientY > bounds.bottom;
}

function closeFromBackdrop(event: MouseEvent): void {
  if (backdropPointerDown && isOutsideDialog(event)) (event.target as HTMLDialogElement).close();
  backdropPointerDown = false;
}

function rememberPointerDown(event: PointerEvent): void {
  backdropPointerDown = isOutsideDialog(event);
}
</script>

<template>
  <div class="study-material-submission">
    <a ref="trigger" :href="`#${titleId}-dialog`" class="study-material-trigger"
      aria-haspopup="dialog" @click.prevent="dialog?.showModal()">
      资料提交与收录
    </a>
    <a ref="suggestionTrigger" :href="`#${suggestionTitleId}-dialog`" class="study-material-trigger"
      aria-haspopup="dialog" @click.prevent="suggestionDialog?.showModal()">
      网站功能建议
    </a>
    <dialog :id="`${titleId}-dialog`" ref="dialog" class="study-material-dialog" :aria-labelledby="titleId"
      :aria-describedby="descriptionId" @close="trigger?.focus()"
      @pointerdown="rememberPointerDown"
      @click="closeFromBackdrop">
      <div class="study-material-content">
        <h2 :id="titleId">资料提交与收录</h2>
        <p :id="descriptionId">欢迎分享希望收录的学习资料，请发送邮件至下方邮箱。</p>
        <div class="study-material-email">
          <img :src="emailImageUrl" alt="资料提交邮箱" width="156" height="21">
        </div>
        <p>请在邮件中注明资料名称、来源及希望收录的内容，并附上资料文件或下载链接。</p>
        <p class="study-material-subject">邮件主题建议：资料提交与收录 — 资料名称</p>
        <div class="study-material-footer">
          <button type="button" class="study-button" autofocus @click="dialog?.close()">关闭</button>
        </div>
      </div>
    </dialog>
    <dialog :id="`${suggestionTitleId}-dialog`" ref="suggestionDialog" class="study-material-dialog"
      :aria-labelledby="suggestionTitleId" @close="suggestionTrigger?.focus()"
      @pointerdown="rememberPointerDown" @click="closeFromBackdrop">
      <div class="study-material-content">
        <h2 :id="suggestionTitleId">网站功能建议</h2>
        <img class="study-material-qr" :src="wechatImageUrl" alt="微信二维码，扫码添加好友并反馈网站功能建议"
          width="820" height="1219">
        <div class="study-material-footer">
          <button type="button" class="study-button" autofocus @click="suggestionDialog?.close()">关闭</button>
        </div>
      </div>
    </dialog>
  </div>
</template>
