<?xml version="1.0" encoding="utf-8"?>

<xsl:stylesheet version="1.0" 
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
        
    <xsl:output method="xml" 
                indent="yes" 
                omit-xml-declaration="yes" />
    
    <xsl:template match="/">
        <xsl:apply-templates select="projects"/>
    </xsl:template>
    
    <xsl:template match="projects">
        <menupopup>
            <xsl:apply-templates select="items/project"/>
        </menupopup>
    </xsl:template>

    <xsl:template match="items/project">
        <xsl:if test="boolean(@sep)">
            <menuseparator />
        </xsl:if>
        <xsl:if test="count(items/*) = 0">
            <menuitem>
                <xsl:if test="image[text()]">
                    <xsl:attribute name="class">
                        <xsl:text>menuitem-iconic</xsl:text>
                    </xsl:attribute>
                    <xsl:attribute name="image">
                        <xsl:text>chrome://lsfbar/skin/images/</xsl:text>
                        <xsl:value-of select="image" />
                    </xsl:attribute>
                </xsl:if>
                <xsl:attribute name="label">
                    <xsl:value-of select="label" />
                </xsl:attribute>
                <xsl:attribute name="tooltiptext">
                    <xsl:value-of select="tooltip" />
                </xsl:attribute>
                <xsl:attribute name="href">
                    <xsl:value-of select="href" />
                </xsl:attribute>
            </menuitem>
        </xsl:if>
        <xsl:if test="count(items/*) > 0">
            <menu>
                <xsl:attribute name="label">
                    <xsl:value-of select="label" />
                </xsl:attribute>
                <xsl:attribute name="tooltiptext">
                    <xsl:value-of select="tooltip" />
                </xsl:attribute>
                
                <menupopup>
                    <xsl:apply-templates select="items/project"/>
                </menupopup>
            </menu>
        </xsl:if>
    </xsl:template>
</xsl:stylesheet>