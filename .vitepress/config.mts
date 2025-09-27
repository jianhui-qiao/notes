import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Joe 的文档与笔记",
  description: "文档与笔记",
  base: "/notes/",
  themeConfig: {
    logo: '/react.svg',
    search: {
      provider: 'local',
    },
    lastUpdated: {
      text: '更新时间',
    },
    outline: {
      label: '文章目录',
    },
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '首页', link: '/' },
      // { text: 'Vue', link: '/document/vue/basic/introduce' },
      // { text: 'React', link: '/document/react/basic/introduce' },
      // { text: 'NodeJS', link: '/document/node/basic/introduce' },
      // { text: 'TypeScript', link: '/document/typescript/basic/introduce' },
      { text: '性能优化', link: '/document/performance/uploading/introduce' },
    ],

    sidebar: {
      // '/document/vue/': [
      //   {
      //     text: 'Vue',
      //     items: [
      //       { text: 'Vue基本介绍', link: '/document/vue/basic/introduce' },
      //     ]
      //   },
      // ],
      // '/document/react/': [
      //   {
      //     text: 'React',
      //     items: [
      //       { text: 'React基本介绍', link: '/document/react/basic/introduce' },
      //     ]
      //   },
      // ],
      // '/document/node/': [
      //   {
      //     text: 'NodeJS',
      //     items: [
      //       { text: 'NodeJS基本介绍', link: '/document/node/basic/introduce' },
      //     ]
      //   }
      // ],
      // '/document/typescript/': [
      //   {
      //     text: 'NodeJS',
      //     items: [
      //       { text: 'TypeScript基本介绍', link: '/document/typescript/basic/introduce' },
      //     ]
      //   }
      // ],
      '/document/performance/': [
        {
          text: '性能优化',
          items: [
            { text: '大文件上传', link: '/document/performance/uploading/introduce' },
          ]
        }
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ],

    docFooter:{
      prev:'上一页',
      next:'下一页'
    },

  },
})
