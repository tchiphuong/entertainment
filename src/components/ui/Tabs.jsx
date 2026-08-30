import { Tabs as HeroTabs } from "@heroui/react";

/**
 * Tabs Compound Component (HeroUI v3)
 * Giữ nguyên 100% tên và anatomy gốc:
 * Tabs, Tabs.ListContainer, Tabs.List, Tabs.Tab, Tabs.Indicator, Tabs.Panel, Tabs.Separator
 */
export const Tabs = ({ children, className = "", ...props }) => {
    return (
        <HeroTabs className={className} {...props}>
            {children}
        </HeroTabs>
    );
};

Tabs.ListContainer = HeroTabs.ListContainer;
Tabs.List = HeroTabs.List;
Tabs.Tab = HeroTabs.Tab;
Tabs.Indicator = HeroTabs.Indicator;
Tabs.Panel = HeroTabs.Panel;
Tabs.Separator = HeroTabs.Separator;

export default Tabs;
