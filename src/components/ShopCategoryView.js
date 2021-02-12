import { BaseElement, html, css } from "./BaseElement.js"
import { didNavigate } from "./utils.js"

export class ShopCategoryView extends BaseElement {
    static get styles() {
        return css`
            :host {
                display: grid;
                margin: 1rem 0 3rem;
                gap: 1rem;
                align-items: start;
            }
            .filters {
                grid-row: 2;
            }
            .results {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
            }
            shop-category-pagination {
                grid-column: span 2;
            }

            @media (min-width: 767px) {
                :host {
                    grid-template-columns: repeat(5, 1fr);
                }
                .filters {
                    grid-row: 1;
                }
                .results {
                    grid-template-columns: repeat(4, 1fr);
                    grid-column: span 4;
                }
                shop-category-pagination {
                    grid-column: span 4;
                }
            }
        `
    }

    static get properties() {
        return {
            url: { type: Object },
            page: { type: Number },
            limit: { type: Number },
            count: { type: Number },
            filters: { type: Array },
            products: { type: Array }
        }
    }

    constructor() {
        super()
        this.products = []
        this.filters = []
        this.url = new URL("http://example.com")
        this.on("selection", ev => {
            const { key, selection } = ev.detail
            const url = new URL(window.location)
            url.searchParams.set(key, selection.join("|"))
            url.searchParams.set("page", "1")
            for (const [k, v] of url.searchParams.entries()) {
                if (!v) url.searchParams.delete(k)
            }
            history.pushState({}, null, url.toString())
            didNavigate()
        })
        this.on("page", ev => {
            const url = new URL(window.location)
            url.searchParams.set("page", ev.detail)
            history.pushState({}, null, url.toString())
            didNavigate()
        })
    }

    get endpoint() {
        return window.siteConfig.collectionEndpoint
    }

    get categories() {
        return window.siteConfig.categoryIndex.slice(0)
    }

    async fetch(url) {
        const slug = url.pathname.replace(/^\/|\/$/g, "")
        const category = this.categories.find(c => c.url == slug)
        if (!category) throw `Could not find category ${category}`

        // Clear screen
        Object.assign(this, {
            url,
            products: null,
            page: 1,
            limit: 16,
            count: 0
        })

        // Fetch results
        const endpoint = new URL(`${this.endpoint}`, window.origin)
        // mirror window search params
        for (const [k, v] of url.searchParams.entries()) {
            endpoint.searchParams.set(k, v)
        }
        // add category search param
        endpoint.searchParams.set("category", category.id)
        endpoint.searchParams.set("limit", url.searchParams.get("limit") || 16)
        endpoint.searchParams.set("page", url.searchParams.get("page") || 1)

        const res = await fetch(endpoint)
        const data = await res.json()

        const currentUrl = new URL(window.location)

        const filters = (data.filters || []).map(f => {
            f.key = `filter[${f._id}]`
            f.unit = f.unit || ""
            const param = currentUrl.searchParams.get(f.key) || ""
            f.selection = param.split("|").filter(f => f)
            return f
        })

        Object.assign(this, {
            page: data.page,
            limit: data.limit,
            count: data.count,
            filters: filters,
            products: data.products || []
        })
    }

    navigate() {
        const url = new URL(window.location)
        if (url.toString() != this.url.toString()) this.fetch(url)
    }

    firstUpdated() {
        document.addEventListener("didNavigate", () => this.navigate())
        this.navigate()
    }

    render() {
        return html`
            <div class="filters">
                ${this.filters.map(
                    f => html`
                        <shop-category-filter
                            .key=${f.key}
                            .display_name=${f.display_name}
                            .type=${f.type}
                            .values=${f.values}
                            .selection=${f.selection}
                            .unit=${f.unit}
                            .presets=${f.presets}
                        ></shop-category-filter>
                    `
                )}
            </div>
            <div class="results">
                ${this.products === null
                    ? html` <p>Loading</p> `
                    : html`
                          ${this.products.length
                              ? html`
                                    ${this.products.map(
                                        p => html`
                                            <shop-category-product
                                                .priceExcl=${p.priceExcl}
                                                .url=${p.url}
                                                .title=${p.title}
                                                .fulltitle=${p.fulltitle}
                                                .image_url=${p.image_url}
                                                .product_set=${p.product_set}
                                                .variants=${p.variants}
                                            ></shop-category-product>
                                        `
                                    )}
                                `
                              : html` <p>No results</p> `}
                      `}
                <shop-category-pagination
                    .page=${this.page}
                    .limit=${this.limit}
                    .count=${this.count}
                ></shop-category-pagination>
            </div>
        `
    }
}
