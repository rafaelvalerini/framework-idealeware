import { Component, Input, OnDestroy, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Location, isPlatformBrowser } from '@angular/common';
import { Product } from '../../../models/product/product';
import { Sku } from '../../../models/product/sku';
import { ProductPicture } from '../../../models/product/product-picture';
import { Category } from '../../../models/category/category';
import { CartManager } from '../../../managers/cart.manager';
import { ProductAwaited } from "../../../models/product-awaited/product-awaited";
import { ProductRating } from "../../../models/product-rating/product-rating";
import { Service } from "../../../models/product-service/product-service";
import { Store } from "../../../models/store/store";
import { EnumStoreModality } from "../../../enums/store-modality.enum";
import { RelatedProductGroup } from "../../../models/related-products/related-product-group";
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { validEmail } from '../../../directives/email-validator/email-validator.directive';
import { AppCore } from '../../../app.core';
import { ProductManager } from '../../../managers/product.manager';
import { KondutoManager } from '../../../managers/konduto.manager';
import { SeoManager } from '../../../managers/seo.manager';

declare var $: any;
declare var swal: any;
declare var toastr: any;
declare const fbq: any;

@Component({
    selector: 'product',
    templateUrl: '../../../templates/product/product/product.html',
    styleUrls: ['../../../templates/product/product/product.scss']
})
export class ProductComponent implements OnInit, OnDestroy {

    id: string;
    productsRating: ProductRating = new ProductRating();
    productsAwaited: ProductAwaited = new ProductAwaited();
    parcelValue: number;
    product: Product = null;
    sku: Sku = null;
    pictures: ProductPicture[] = [];
    feature: string = null;
    services: Service[] = [];
    videoSafeUrl: SafeResourceUrl;
    fileGuideSafeUrl: SafeResourceUrl;
    coverImg: ProductPicture = new ProductPicture();
    mediaPath: string;
    related: RelatedProductGroup = new RelatedProductGroup();
    modality: EnumStoreModality = -1;
    showValuesProduct: boolean = false;
    allOptionsSelected: boolean = false;
    totalNote: number = 0;
    installment: string = '';
    productAwaitedForm: FormGroup;
    store: Store;

    @Input() quantity: number = 1;
    @Input() areaSizer: number = 0;

    constructor(
        private seoManager: SeoManager,
        private kondutoManager: KondutoManager,
        private cartManager: CartManager,
        private manager: ProductManager,
        private route: ActivatedRoute,
        private router: Router,
        private location: Location,
        private sanitizer: DomSanitizer,
        @Inject(PLATFORM_ID) private platformId: Object
    ) {
        this.productAwaitedForm = new FormBuilder().group({
            name: ['', Validators.required],
            email: ['', Validators.compose([
                Validators.required,
                validEmail()
            ])],
        });
    }

    /* Lifecycle events */
    ngOnInit() {
        this.route.params.subscribe(() => {
            this.store = this.route.snapshot.data.store;
            this.mediaPath = `${this.store.link}/static/products/`;
            this.modality = this.store.modality;
            this.showValuesProduct = this.showValues(this.store);

            if (isPlatformBrowser(this.platformId)) {
                $('body').addClass('product');
            }

            this.id = this.route.snapshot.params.produto_id;
            this.id = this.id.substr(this.id.length - 36);

            this.loadProduct(this.route.snapshot.data.product);
        });
    }

    ngOnDestroy() {
        if (isPlatformBrowser(this.platformId)) {
            this.kondutoManager.clearProductMeta();
            $('body').removeClass('product');
        }
    }

    isMobile(): boolean {
        if (isPlatformBrowser(this.platformId)) {
            return AppCore.isMobile(window);
        }
        else return false;
    }

    accordion(id) {
        if (isPlatformBrowser(this.platformId)) {
            var $button = $(id).siblings('button');
            if ($(id).length) {
                if ($(id).is(':visible')) {
                    $(id).slideUp();
                    $button.find('.fa').removeClass('fa-chevron-up').addClass('fa-chevron-down');
                } else {
                    $(id).slideDown();
                    $button.find('.fa').removeClass('fa-chevron-down').addClass('fa-chevron-up');
                }
            }
        }
    }

    /* Cart Events */
    addToCart() {
        if (this.product.selfColor && !this.feature) {
            swal({
                title: "Cor necessária",
                text: "É necessário escolher uma cor para o produto",
                type: "warning",
                confirmButtonText: "OK"
            });
        }
        else if (!this.allOptionsSelected) {
            swal({
                title: 'Característica não selecionada',
                text: 'Selecione as características desejadas antes de adicionar ao carrinho',
                type: 'warning',
                confirmButtonText: 'OK'
            });
        }
        else {
            this.cartManager.purchase(/*localStorage.getItem('cart_id'), */this.product, this.sku, this.quantity, this.feature)
                .subscribe(cart => {
                    this.cartManager.addItem(cart.id, this.sku.id, this.quantity, this.feature).subscribe(cartAdd => {
                        
                        fbq('track', 'AddToCart', {
                            value: this.sku.price,
                            currency: 'BRL',
                            content_ids: this.sku.id,
                        });


                        toastr['success']('Produto adicionado ao carrinho');
                        if (this.services.length > 0)
                            this.services.forEach(service => {
                                this.cartManager.addService(service.id, service.quantity, localStorage.getItem('cart_id'));
                            });
                        this.router.navigateByUrl('/carrinho');
                    })
                }, err => {
                    swal({
                        title: "Falha ao adicionar o produto ao carrinho",
                        text: err.error,
                        type: "warning",
                        confirmButtonText: "OK"
                    });
                });
        }
    }


    /* Get SKU */
    open(event, item: string) {
        if (event)
            event.preventDefault()
        this.setCurrentSku(item);
        this.location.replaceState(`${AppCore.getNiceName(this.product.name)}-${item}`);
    }

    handleSkuUpdated(event: Sku) {
        if (this.sku.id != event.id)
            this.open(null, event.id);
    }

    handleProductUpdated(event: Product) {
        this.product = event;
        this.sku = event.skuBase;
        this.setCurrentSku(this.sku.id);
        this.location.replaceState(`/${AppCore.getNiceName(this.product.name)}-${this.sku.id}`);
    }

    handleOptionChanged(event: boolean) {
        this.allOptionsSelected = event;
    }

    setCurrentSku(skuId: string = null) {
        this.allOptionsSelected = true;
        return new Promise((resolve) => {
            if (skuId)
                this.sku = this.manager.getSku(skuId, this.product);
            else
                this.sku = this.manager.getSku(this.id, this.product);
            this.getImages();
            this.getCoverImage();

            if (!this.isCatalog() && this.isProductAvailable())
                this.getInstallmentValue();

            resolve(this.product);
        })

    }

    private loadProduct(product: Product) {
        this.product = product;
        this.setCurrentSku(this.id);

        this.seoManager.setTags({
            title: product.metaTagTitle || product.name,
            description: product.metaTagDescription || product.briefDescription,
            image: this.getImageProduct(product)
        });

        this.kondutoManager.addProductMeta(this.product);

        if (this.product.name.toLowerCase().indexOf('tinta') !== -1 && this.store.domain === 'ecommerce') {
            this.product.selfColor = true;
        }
        if (product.videoEmbed) {
            this.videoSafeUrl = this.createSafeUrl(this.product.videoEmbed);
        }
        if (product.fileGuide) {
            this.fileGuideSafeUrl = this.createSafeUrl(`javascript:window.open('${this.mediaPath}${product.fileGuide}');`);
        }

        if (this.isProductRelated()) {
            this.manager.getRelatedProductGroupById(this.product.relatedProductsId)
                .subscribe(related => {
                    this.related = related;
                    if (this.related.products.length == 0)
                        this.product.relatedProductsId = null;
                });
        }
    }


    /* Breadcrump */
    getBreadCrump(): Category[] {
        return this.product.categories;
    }


    /* Installment Simulator */
    private getInstallmentValue() {
        if (this.product.installmentNumber > 0 && this.product.installmentValue > 0) {
            this.installment = `em ${this.product.installmentNumber}x de R$ ${this.product.installmentValue.toFixed(2).toString().replace('.', ',')}`;
        }

    }

    /* Images */
    private getCoverImage() {
        if (this.manager.hasCoverImage(this.sku.id, this.product)) {
            this.coverImg = this.manager.getSkuCoverImage(this.sku.id, this.product);
        }
        else return null;

    }

    private getImages() {
        this.pictures = this.manager.getSkuImages(this.sku.id, this.product);
    }

    /* Product Awaited */
    receiveProductsAwaited(event) {
        if (isPlatformBrowser(this.platformId)) {
            event.preventDefault();
            if (this.productAwaitedForm.invalid) {
                for (let i in this.productAwaitedForm.controls) {
                    (<any>this.productAwaitedForm.controls[i])._touched = true;
                }
                swal('Erro', 'Informe corretamente os campos informados', 'error');
                return;
            }
            else {
                let productName = this.product.name;
                this.sku.variations.forEach(v => {
                    productName += `-${v.name} : ${v.option.name}`;
                });

                this.productsAwaited.productName = productName;
                this.productsAwaited.skuId = this.sku.id;
                this.manager.createProductAwaited(this.productsAwaited)
                    .subscribe(() => {
                        swal('Avise-me quando chegar', 'E-mail cadastrado com sucesso.', 'success');
                        this.productsAwaited = new ProductAwaited();
                        this.productAwaitedForm.reset();
                    }, () => {
                        swal('Erro ao cadastrar email', 'Não foi possível cadastrar seu email', 'error');
                    });
            }
        }
    }


    /* Loss Percentage */
    getLossPercentage(event = null) {
        if (event)
            event.preventDefault();

        if (this.product.lossPercentage > 0) {
            if (this.areaSizer > 0 && this.product.areaSizer > 0) {
                let quant = Math.ceil((this.areaSizer + this.product.lossPercentage) / this.product.areaSizer);
                this.quantity = quant;
            }
            else {
                let percentege = (this.product.lossPercentage * this.quantity);
                if (percentege <= 100) {
                    this.quantity += 1;
                }
                else {
                    this.quantity += Math.ceil((percentege / 100));
                }
            }
        }
    }

    /* Area Sizer */
    getAreaSizer(event = null) {
        if (event)
            event.preventDefault();

        if (this.areaSizer > 0 && this.product.areaSizer > 0) {
            this.quantity = Math.ceil(this.areaSizer / this.product.areaSizer);
        }
    }

    /* Rating */
    getRating() {
        if (this.productsRating.customers) {
            let total = 0;
            this.productsRating.customers.forEach(a => {
                total += a.note;
            });
            this.totalNote = Math.ceil(total / this.productsRating.customers.length);
            return this.productsRating.customers.length;
        }
        else return 0;
    }

    handleRating(event) {
        this.productsRating = event;
    }

    /* Color Picker Events */
    colorPicker(event) {
        event.preventDefault();
    }

    /* Services */
    handleServiceUpdated(event) {
        let service = event;
        let index = this.services.findIndex(s => s.id == service.id);
        if (index > -1) {
            if (service.quantity == 0)
                this.services.splice(index);
            else
                this.services[index] = service
        }
        else if (service.quantity > 0)
            this.services.push(service);
    }

    createSafeUrl(url: string): SafeResourceUrl {
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    showValues(store): boolean {
        if (this.modality == 1) {
            return true;
        }
        else if (this.modality == 0 && store.settings.find(s => s.type == 3 && s.status == true)) {
            return true;
        }
    }

    hasTechnicalInformation(): boolean {
        if (this.product.technicalInformation.length > 0 && this.product.technicalInformation[0].name)
            return true;
        else
            return false;
    }

    getTotalServices(): number {
        if (this.services.length <= 0)
            return 0;
        else {
            let total = 0;
            this.services.forEach(service => {
                total += service.price * service.quantity;
            });
            return total;
        }
    }

    isProductAvailable(): boolean {
        if (this.store.modality == EnumStoreModality.Budget && this.sku.available)
            return true;
        else if (this.store.modality == EnumStoreModality.Ecommerce && this.sku.available && this.sku.stock > 0)
            return true;
        else return false;
    }

    isCatalog(): boolean {
        if (this.store.modality == EnumStoreModality.Budget)
            return true;
        else return false;
    }

    isProductRelated(): boolean {
        let isGuidEmpty: boolean = (this.product.relatedProductsId) ? !AppCore.isGuidEmpty(this.product.relatedProductsId) : false;
        return isGuidEmpty;
    }

    isHiddenVariation(): boolean {
        let type = this.store.settings.find(s => s.type == 4);
        if (type)
            return type.status;
        else
            return false;
    }

    getStore(): Store {
        return this.store;
    }

    downloadGuide(event) {
        event.preventDefault();
        this.router.navigateByUrl(this.mediaPath + this.product.fileGuide);
    }

    isGuid(value: string): boolean {
        return AppCore.isGuid(value);
    }

    hasError(key: string): boolean {
        let error: boolean = (this.productAwaitedForm.controls[key].touched && this.productAwaitedForm.controls[key].invalid);
        return error;
    }

    hasFileGuide(): boolean {
        if (this.product && this.product.fileGuide) {
            return true;
        }
        return false;
    }

    hasVideo(): boolean {
        if (this.product && this.product.videoEmbed) {
            return true;
        }
        return false;
    }

    getProduct(): Product {
        if (this.product && this.product.id) {
            return this.product;
        }
        return null;
    }

    isProductLoaded(): boolean {
        if (this.getProduct() && this.getStore()) {
            return true;
        }
        return false;
    }

    getImageProduct(product: Product): string {
        let picture = product.skuBase.picture || null;
        if (picture) {
            return `${this.store.link}/static/products/${picture.showcase}`;
        }
        return `${this.store.link}/static/store/${this.store.logo}`;
    }

    /**
     * Exibe ou oculta o estoque baseado na configuração da loja
     * Default: false
     * @returns 
     * @memberof ProductComponent
     */
    showStock(): boolean {
        if (this.store) {
            if (this.isCatalog()) {
                return false;
            }
            else {
                let showStock = this.store.settings.find(s => s.type == 5);
                if (showStock && showStock.status) {
                    return true;
                }
                return false;
            }
        }
        return false;
    }
}