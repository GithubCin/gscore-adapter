import { Context } from '@koishijs/client';
import Page from './page.vue';
import './icon';

export default (ctx: Context) => {
    // 此 Context 非彼 Context
    // 我们只是在前端同样实现了一套插件逻辑
    ctx.page({
        name: '早柚核心',
        icon: 'gscore',
        path: '/gsuid-core',
        component: Page,
    });
};
