export class VariationOption {
    id: string;
    name: string;
    picture: string;
    quantity: number;

    constructor(option = null){
        if(option) return this.createFromResponse(option);
    }

    public createFromResponse(response) : VariationOption{
        let model = new VariationOption();

        for(var k in response){
            model[k] = response[k];
        }

        return model;
    }
}