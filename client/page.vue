<template>
    <div style="text-align: center;position: absolute;width: calc(100% - 64px);height: calc(100% - 28px);left: 64px;">
        <iframe ref="frame" frameborder="0" width="100%" height="100%" scrolling="no" :src="host"> </iframe>
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { store } from '@koishijs/client';
export default defineComponent({
    setup() {
        const custom: string[] = store['gscore-custom'];
        const [hostname, port, protocol, path] = custom;
        const host = `${protocol}//${hostname}:${port}/${path}`;
        return {
            host
        }
    }
})
</script>