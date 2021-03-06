import { Component, Input, OnInit, OnChanges, SimpleChanges, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Payment } from "../../../models/payment/payment";
import { Sku } from "../../../models/product/sku";
import { PaymentManager } from "../../../managers/payment.manager";
import { PaymentMethod } from "../../../models/payment/payment-method";
import { Installment } from "../../../models/payment/installment";
import { PaymentSetting } from "../../../models/payment/payment-setting";
import { InstallmentsSimulation } from '../../../models/payment/installments-simulation';

@Component({
    selector: 'installment-simulation',
    templateUrl: '../../../templates/shared/installment-simulation/installment-simulation.html',
    styleUrls: ['../../../templates/shared/installment-simulation/installment-simulation.scss']
})
export class InstallmentSimulationComponent implements OnInit, OnChanges {
    @Input() sku: Sku;
    @Input() isSimpleSimulation: Boolean;


    payments: Payment[] = [];
    simulation: Payment = new Payment();
    gatewaySelected: Payment = new Payment();
    error: string;
    installments: InstallmentsSimulation = new InstallmentsSimulation();

    private id: string;

    constructor(
        private manager: PaymentManager,
        @Inject(PLATFORM_ID) private platformId: Object
    ) { }

    ngOnInit() {
        if (isPlatformBrowser(this.platformId)) {
            this.getSimulationSimple();
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (isPlatformBrowser(this.platformId)) {
            if (changes.sku) {
                this.simulation.paymentMethods = [];
                this.getSimulationSimple();
            }
        }
    }

    getSimulationSimple() {
        if (isPlatformBrowser(this.platformId)) {
            this.manager.getInstallmentsSimulationSimpleBySkuId(this.sku.id)
                .subscribe(installments => this.installments = installments);
        }
    }

    getSimulation(event = null) {
        if (isPlatformBrowser(this.platformId)) {
            if (event)
                event.preventDefault();
            this.error = null;
            this.id = this.sku.id;
            this.payments = [];
            this.manager.simulateInstallmentsBySkuId(this.id)
                .subscribe(simulations => {
                    if (simulations.length == 0) {
                        this.error = 'Não há formas de pagamentos definidas';
                        return;
                    }
                    this.payments = simulations;

                    this.payments.forEach(payment => {
                        if (!this.isPagseguro(payment)) {
                            let installmentLimit: PaymentSetting = payment.settings.find(s => s.name.toLowerCase() == 'installmentlimit');
                            if (installmentLimit) {
                                payment.paymentMethods[0].installment = payment.paymentMethods[0].installment.slice(0, Number.parseInt(installmentLimit.value));
                            }
                        }
                    });

                    this.selectGateway(this.defaultPayment(this.payments));
                }, error => {
                    this.error = `Não foi possível obter o parcelamento (Erro: ${error.status})`;
                    this.payments = [];
                });
        }
    }

    hasSimulation(): boolean {
        if (isPlatformBrowser(this.platformId)) {
            return this.manager.hasMundipaggCreditCard(this.payments);
        }
    }

    nonEmptyMethod(): PaymentMethod[] {
        if (isPlatformBrowser(this.platformId)) {
            return this.simulation.paymentMethods.filter(m => m.installment.length > 0);
        }
    }

    getMaxInstallment(gateway: Payment): string {
        if (isPlatformBrowser(this.platformId)) {
            let method = (gateway.paymentMethods.length > 0) ? gateway.paymentMethods[0] : new PaymentMethod();
            let maxInstallment: number = 0;

            if (this.isMundiPagg(gateway))
                maxInstallment = method.installment[method.installment.length - 1].number;
            else if (this.isMercadoPago(gateway))
                maxInstallment = method.installment.length;

            else if (this.isPagseguro(gateway))
                maxInstallment = method.installment[method.installment.length - 1].number;

            return `Pague em até ${maxInstallment}x no cartão de crédito pagando com ${gateway.name}`;
        }
    }

    selectGateway(gateway: Payment) {
        if (isPlatformBrowser(this.platformId)) {
            this.gatewaySelected = gateway;
        }
    }

    isSelected(gateway: Payment): boolean {
        if (isPlatformBrowser(this.platformId)) {
            if (this.gatewaySelected && this.gatewaySelected.id == gateway.id)
                return true;
            else
                return false;
        }
    }

    defaultPayment(payments: Payment[]): Payment {
        if (isPlatformBrowser(this.platformId)) {
            return payments.find(p => p.default == true);
        }
    }

    getInstallments(payment: Payment): Installment[] {
        if (isPlatformBrowser(this.platformId)) {
            if (payment.paymentMethods.length > 0)
                return payment.paymentMethods[0].installment;
            else return []
        }
    }

    isMundiPagg(gateway: Payment): boolean {
        if (isPlatformBrowser(this.platformId)) {
            if (this.manager.isMundiPagg(gateway))
                return true;
            else return false;
        }
    }

    isMercadoPago(gateway: Payment): boolean {
        if (isPlatformBrowser(this.platformId)) {
            return this.manager.isMercadoPago(gateway, this.payments);
        }
    }

    isPagseguro(gateway: Payment): boolean {
        if (isPlatformBrowser(this.platformId)) {
            return this.manager.isPagSeguro(gateway, this.payments);
        }
    }

}