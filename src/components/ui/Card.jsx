import { Card as HeroCard } from "@heroui/react";

/**
 * Card Compound Component (HeroUI v3)
 * Giữ nguyên 100% tên và anatomy gốc:
 * Card, Card.Header, Card.Title, Card.Description, Card.Content, Card.Footer
 */
export const Card = ({ children, className = "", ...props }) => {
    return (
        <HeroCard className={className} {...props}>
            {children}
        </HeroCard>
    );
};

Card.Header = HeroCard.Header;
Card.Title = HeroCard.Title;
Card.Description = HeroCard.Description;
Card.Content = HeroCard.Content;
Card.Footer = HeroCard.Footer;

export default Card;
