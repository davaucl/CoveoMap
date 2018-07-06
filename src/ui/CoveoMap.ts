import {
    Component,
    ComponentOptions,
    IComponentBindings,
    $$,
    IStringMap,
    QueryEvents,
    IBuildingQueryEventArgs,
    Initialization
  } from 'coveo-search-ui';

interface IMapDefinition {
    mapElement: HTMLElement;
}

export class CoveoMap extends Component {
    static ID = 'CoveoMap';

    private tabsDefinition: IStringMap<IMapDefinition> = {};
    constructor(public element: HTMLElement, public bindings: IComponentBindings) {
        super(element, CoveoMap.ID, bindings);

        this.initMap();
    }

    public initMap() {
        const map = new google.maps.Map(document.getElementById('map'), {
            center: {lat: -34.397, lng: 150.644},
            zoom: 8
          });
    }
}
